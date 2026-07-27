import {
  diffAlerts,
  evaluateRules,
  alertKey,
  type Snapshot,
  type AlertKind,
} from "./rules.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    fail++;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
  } else console.log(`ok   ${label}`);
}

const base: Snapshot = {
  unitId: "D01393",
  ts: "2026-07-27T00:00:00Z",
  cpuUsage: 20,
  memoryUsedBytes: 1,
  memoryTotalBytes: 4,
  batteryCharge: 90,
  storagePresent: true,
  storageUsedBytes: 10,
  storageSizeBytes: 100,
  firmwareRunning: "S5.1.2-1",
  firmwareDefault: "S5.1.2-1",
  encoders: [
    {
      index: 0,
      description: "Program out",
      active: true,
      totalBitrate: 8_000_000,
      destinations: [{ id: "d1", bitrate: 8_100_000, packetLoss: 0.01 }],
    },
  ],
  inputs: [{ index: 0, description: "Main ingest", active: true, bitrate: 8_400_000, packetLoss: 0.02 }],
  interfaces: [
    { name: "eth0", index: 0, internetAccess: true, linkUp: true, rxBitrate: 1, txBitrate: 1, signalStrength: null },
    { name: "wwan0", index: 1, internetAccess: false, linkUp: false, rxBitrate: 0, txBitrate: 0, signalStrength: null },
  ],
};

const kinds = (s: Snapshot, ctx = {}) =>
  evaluateRules(s, ctx).map((a) => alertKey(a.kind, a.subject)).sort();

// --- healthy baseline -------------------------------------------------------
eq(kinds(base), [], "healthy snapshot raises nothing");

// The no-SIM cellular modem is down but never had connectivity → must not alert,
// otherwise it would fire on every single poll forever.
eq(
  kinds(base).filter((k) => k.startsWith("link_loss")),
  [],
  "permanently-down interface with no history does not alert",
);

// --- stream down ------------------------------------------------------------
const encDown: Snapshot = {
  ...base,
  encoders: [{ ...base.encoders[0], totalBitrate: 0, destinations: [{ id: "d1", bitrate: 0, packetLoss: 0 }] }],
};
eq(kinds(encDown), ["stream_down:encoder:0"], "active encoder at 0 bit/s alerts");

const encInactive: Snapshot = {
  ...base,
  encoders: [{ ...base.encoders[0], active: false, totalBitrate: 0, destinations: [] }],
};
eq(kinds(encInactive), [], "inactive encoder at 0 bit/s does NOT alert");

const inputDown: Snapshot = { ...base, inputs: [{ ...base.inputs[0], bitrate: 0 }] };
eq(kinds(inputDown), ["stream_down:input:0"], "active input at 0 bit/s alerts");

// --- firmware ---------------------------------------------------------------
eq(
  kinds({ ...base, firmwareDefault: "S5.2.0-1" }),
  ["firmware_update:system"],
  "running != recommended alerts",
);
eq(
  kinds({ ...base, firmwareRunning: null, firmwareDefault: "S5.2.0-1" }),
  [],
  "missing version info does not alert",
);

// --- storage ----------------------------------------------------------------
eq(kinds({ ...base, storageUsedBytes: 89 }), [], "89% full does not alert");
eq(kinds({ ...base, storageUsedBytes: 90 }), ["storage_full:storage"], "90% full alerts");
eq(
  kinds({ ...base, storagePresent: false, storageUsedBytes: 99 }),
  [],
  "absent storage does not alert",
);

// --- link loss (transition-scoped) -----------------------------------------
const ethDown: Snapshot = {
  ...base,
  interfaces: [{ ...base.interfaces[0], internetAccess: false, linkUp: false }, base.interfaces[1]],
};
eq(kinds(ethDown, { previous: base }), ["link_loss:eth0"], "interface that HAD connectivity alerts on loss");
eq(kinds(ethDown, { previous: null }), [], "no previous sample → no link alert (cold start is not an outage)");
eq(
  kinds(ethDown, { previous: ethDown, openKeys: new Set(["link_loss:eth0"]) }),
  ["link_loss:eth0"],
  "condition persists while the episode is open",
);
eq(
  kinds(ethDown, { previous: ethDown }),
  [],
  "still down, no open episode, no prior connectivity → stays quiet",
);

// --- diffing / anti-spam ----------------------------------------------------
type Row = { id: number; kind: AlertKind; subject: string };
const detected = evaluateRules(encDown);
const openRows: Row[] = [{ id: 7, kind: "stream_down", subject: "encoder:0" }];

const first = diffAlerts(detected, []);
eq([first.opened.length, first.resolved.length, first.ongoing.length], [1, 0, 0], "first detection opens one episode");

const second = diffAlerts(detected, openRows);
eq(
  [second.opened.length, second.resolved.length, second.ongoing.length],
  [0, 0, 1],
  "re-detecting the same condition opens nothing (anti-spam)",
);

const recovered = diffAlerts([], openRows);
eq(
  [recovered.opened.length, recovered.resolved.length, recovered.ongoing.length],
  [0, 1, 0],
  "condition clearing resolves the episode",
);
eq(recovered.resolved[0].id, 7, "resolved episode carries its row id for closing");

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
