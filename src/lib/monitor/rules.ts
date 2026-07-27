/**
 * Alert rules — pure functions over a snapshot, no I/O.
 *
 * Design note: rules report **conditions that are true right now**, not
 * events. The caller diffs that set against the alert episodes currently open
 * in the database, so an alert fires once when a condition appears and once
 * more (as a recovery) when it clears. A stream that is down for an hour
 * produces one message, not one per poll — which is the difference between
 * alerting people find useful and alerting they mute.
 *
 * Some conditions are only meaningful as a *change* (an interface that never
 * had connectivity — the cellular modem with no SIM — must not alert forever).
 * Those consult the previous sample and whether an episode is already open,
 * which is why `evaluateRules` takes both.
 */

export type AlertKind = "stream_down" | "firmware_update" | "storage_full" | "link_loss";
export type AlertSeverity = "warning" | "error";

export interface DetectedAlert {
  kind: AlertKind;
  /** Stable identifier for the thing that is wrong: `encoder:0`, `eth0`, … */
  subject: string;
  severity: AlertSeverity;
  message: string;
}

export interface SnapshotEncoder {
  index: number;
  description: string;
  active: boolean;
  totalBitrate: number | null;
  destinations: Array<{ id: string; bitrate: number | null; packetLoss: number | null }>;
}

export interface SnapshotInput {
  index: number;
  description: string;
  active: boolean;
  bitrate: number | null;
  packetLoss: number | null;
}

export interface SnapshotInterface {
  name: string;
  index: number;
  internetAccess: boolean;
  linkUp: boolean;
  rxBitrate: number | null;
  txBitrate: number | null;
  signalStrength: number | null;
}

export interface Snapshot {
  unitId: string;
  ts: string;
  cpuUsage: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  batteryCharge: number | null;
  storagePresent: boolean;
  storageUsedBytes: number | null;
  storageSizeBytes: number | null;
  firmwareRunning: string | null;
  firmwareDefault: string | null;
  encoders: SnapshotEncoder[];
  inputs: SnapshotInput[];
  interfaces: SnapshotInterface[];
}

/** Fraction of storage in use at which `storage_full` fires. */
export const STORAGE_FULL_RATIO = 0.9;

export interface EvaluateContext {
  /** The previous stored sample, if any — used for transition-only rules. */
  previous?: Snapshot | null;
  /** `kind:subject` keys with an alert episode already open. */
  openKeys?: Set<string>;
}

export function alertKey(kind: AlertKind, subject: string): string {
  return `${kind}:${subject}`;
}

export function evaluateRules(
  snapshot: Snapshot,
  ctx: EvaluateContext = {},
): DetectedAlert[] {
  const { previous = null, openKeys = new Set<string>() } = ctx;
  const alerts: DetectedAlert[] = [];

  // -- stream down ---------------------------------------------------------
  // An encoder that is switched on but pushing nothing. Checked as a state
  // rather than a transition: at a one-minute cadence, "active with zero
  // output" is already a sustained fault, not a blip.
  for (const enc of snapshot.encoders) {
    if (!enc.active) continue;
    const total = enc.totalBitrate ?? 0;
    const destTotal = enc.destinations.reduce((sum, d) => sum + (d.bitrate ?? 0), 0);
    if (total === 0 && destTotal === 0) {
      alerts.push({
        kind: "stream_down",
        subject: `encoder:${enc.index}`,
        severity: "error",
        message: `Encoder ${enc.index} (${enc.description || "no description"}) is active but pushing 0 bit/s.`,
      });
    }
  }

  for (const input of snapshot.inputs) {
    if (!input.active) continue;
    if ((input.bitrate ?? 0) === 0) {
      alerts.push({
        kind: "stream_down",
        subject: `input:${input.index}`,
        severity: "error",
        message: `Network input ${input.index} (${input.description || "no description"}) is active but receiving 0 bit/s.`,
      });
    }
  }

  // -- firmware update available -------------------------------------------
  if (
    snapshot.firmwareRunning &&
    snapshot.firmwareDefault &&
    snapshot.firmwareRunning !== snapshot.firmwareDefault
  ) {
    alerts.push({
      kind: "firmware_update",
      subject: "system",
      severity: "warning",
      message: `Firmware update available: running ${snapshot.firmwareRunning}, unit recommends ${snapshot.firmwareDefault}.`,
    });
  }

  // -- storage full --------------------------------------------------------
  if (
    snapshot.storagePresent &&
    snapshot.storageSizeBytes &&
    snapshot.storageUsedBytes != null &&
    snapshot.storageSizeBytes > 0
  ) {
    const ratio = snapshot.storageUsedBytes / snapshot.storageSizeBytes;
    if (ratio >= STORAGE_FULL_RATIO) {
      alerts.push({
        kind: "storage_full",
        subject: "storage",
        severity: "warning",
        message: `Storage ${(ratio * 100).toFixed(0)}% full (${fmtGb(snapshot.storageUsedBytes)} of ${fmtGb(snapshot.storageSizeBytes)}). Recordings may fail.`,
      });
    }
  }

  // -- link loss -----------------------------------------------------------
  // Transition-scoped on purpose: only interfaces that *had* connectivity can
  // lose it. Without this, the cellular modem with no SIM would alert on
  // every poll, forever.
  const prevByName = new Map(
    (previous?.interfaces ?? []).map((i) => [i.name, i] as const),
  );
  for (const iface of snapshot.interfaces) {
    const nowDown = !iface.internetAccess || !iface.linkUp;
    if (!nowDown) continue;
    const prev = prevByName.get(iface.name);
    const hadConnectivity = prev ? prev.internetAccess && prev.linkUp : false;
    const alreadyOpen = openKeys.has(alertKey("link_loss", iface.name));
    if (hadConnectivity || alreadyOpen) {
      alerts.push({
        kind: "link_loss",
        subject: iface.name,
        severity: "error",
        message: `Interface ${iface.name} lost connectivity (link ${iface.linkUp ? "up" : "down"}, internet ${iface.internetAccess ? "yes" : "no"}).`,
      });
    }
  }

  return alerts;
}

function fmtGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

// ---------------------------------------------------------------------------
// Diffing detected conditions against currently-open episodes
// ---------------------------------------------------------------------------

export interface AlertDiff<TOpen> {
  /** Conditions that just appeared — open an episode and notify. */
  opened: DetectedAlert[];
  /** Episodes whose condition has cleared — close and send a recovery note. */
  resolved: TOpen[];
  /** Still true and already open — do nothing (this is the anti-spam path). */
  ongoing: TOpen[];
}

export function diffAlerts<TOpen extends { kind: AlertKind; subject: string }>(
  detected: DetectedAlert[],
  open: TOpen[],
): AlertDiff<TOpen> {
  const detectedKeys = new Set(detected.map((d) => alertKey(d.kind, d.subject)));
  const openKeys = new Set(open.map((o) => alertKey(o.kind, o.subject)));

  return {
    opened: detected.filter((d) => !openKeys.has(alertKey(d.kind, d.subject))),
    resolved: open.filter((o) => !detectedKeys.has(alertKey(o.kind, o.subject))),
    ongoing: open.filter((o) => detectedKeys.has(alertKey(o.kind, o.subject))),
  };
}
