import "server-only";

/**
 * Alert delivery. Every channel is opt-in via env vars and silently inactive
 * when unconfigured, so a fresh deployment sends nothing until someone
 * deliberately wires up a destination.
 *
 * `ALERTS_DRY_RUN=1` resolves every channel but logs instead of sending —
 * useful for verifying rules and formatting without messaging a real channel.
 */

import type { AlertSeverity } from "./rules";

export interface AlertMessage {
  unitId: string;
  severity: AlertSeverity;
  /** true for "condition cleared" notices. */
  recovery: boolean;
  title: string;
  body: string;
}

export interface DeliveryResult {
  channel: string;
  ok: boolean;
  detail?: string;
}

function dryRun(): boolean {
  return process.env.ALERTS_DRY_RUN === "1";
}

function formatPlain(msg: AlertMessage): string {
  const marker = msg.recovery ? "RESOLVED" : msg.severity === "error" ? "ALERT" : "WARNING";
  return `[${marker}] ${msg.unitId}: ${msg.title}\n${msg.body}`;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

async function sendTelegram(msg: AlertMessage): Promise<DeliveryResult | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  if (dryRun()) return { channel: "telegram", ok: true, detail: "dry-run" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatPlain(msg),
      disable_notification: msg.recovery,
    }),
  });
  return { channel: "telegram", ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
}

async function sendSlack(msg: AlertMessage): Promise<DeliveryResult | null> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return null;
  if (dryRun()) return { channel: "slack", ok: true, detail: "dry-run" };

  const emoji = msg.recovery ? "✅" : msg.severity === "error" ? "🔴" : "⚠️";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${emoji} *${msg.unitId}* — ${msg.title}`,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `${emoji} *${msg.unitId}* — ${msg.title}\n${msg.body}` },
        },
      ],
    }),
  });
  return { channel: "slack", ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
}

async function sendEmail(msg: AlertMessage): Promise<DeliveryResult | null> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM;
  if (!key || !to || !from) return null;
  if (dryRun()) return { channel: "email", ok: true, detail: "dry-run" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: to.split(",").map((s) => s.trim()),
      subject: `[${msg.recovery ? "Resolved" : msg.severity === "error" ? "Alert" : "Warning"}] ${msg.unitId}: ${msg.title}`,
      text: formatPlain(msg),
    }),
  });
  return { channel: "email", ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
}

/**
 * Generic JSON webhook — the escape hatch for anything not covered above
 * (n8n, Zapier, a self-hosted receiver), and what the local test harness
 * points at so alert delivery can be verified without a real Slack/Telegram.
 */
async function sendWebhook(msg: AlertMessage): Promise<DeliveryResult | null> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return null;
  if (dryRun()) return { channel: "webhook", ok: true, detail: "dry-run" };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  return { channel: "webhook", ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
}

const CHANNELS = [sendTelegram, sendSlack, sendEmail, sendWebhook];

/** Which channels are configured — surfaced by the cron response for setup checks. */
export function configuredChannels(): string[] {
  const out: string[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) out.push("telegram");
  if (process.env.SLACK_WEBHOOK_URL) out.push("slack");
  if (process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO && process.env.ALERT_EMAIL_FROM) {
    out.push("email");
  }
  if (process.env.ALERT_WEBHOOK_URL) out.push("webhook");
  return out;
}

/**
 * Deliver one alert to every configured channel. A channel failing never
 * throws — the cron run must still record its sample and close out its
 * bookkeeping even if Slack is having a bad day.
 */
export async function deliver(msg: AlertMessage): Promise<DeliveryResult[]> {
  const results = await Promise.all(
    CHANNELS.map(async (send) => {
      try {
        return await send(msg);
      } catch (err) {
        return {
          channel: send.name.replace(/^send/, "").toLowerCase(),
          ok: false,
          detail: err instanceof Error ? err.message : "send failed",
        } satisfies DeliveryResult;
      }
    }),
  );
  return results.filter((r): r is DeliveryResult => r !== null);
}
