/**
 * Replaces Vercel's own Cron (Hobby plan only fires once a day) as the thing
 * that actually drives near-real-time alerting: this Worker's Cron Trigger
 * fires every minute and just calls the dashboard's existing
 * /api/cron/poll — all the real logic (collecting snapshots, diffing
 * alerts, notifying) still lives there. See README §Phase 25 in the main
 * Intinor repo.
 */
export interface Env {
  DASHBOARD_URL: string;
  CRON_SECRET: string;
}

interface PollResult {
  ok: boolean;
  status: number;
  body?: unknown;
  error?: string;
}

async function pollOnce(env: Env): Promise<PollResult> {
  const url = `${env.DASHBOARD_URL.replace(/\/$/, "")}/api/cron/poll`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) {
      console.error(`poll failed: ${res.status} ${JSON.stringify(body)}`);
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    const error = err instanceof Error ? err.message : "fetch failed";
    console.error(`poll errored: ${error}`);
    return { ok: false, status: 0, error };
  }
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(pollOnce(env));
  },

  // No real HTTP surface — this Worker only does anything on its Cron
  // Trigger. `wrangler dev --test-scheduled` hits this path to trigger the
  // scheduled handler locally without waiting for a real minute to pass;
  // a plain visit just explains itself rather than 404ing.
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/__scheduled") {
      return Response.json(await pollOnce(env));
    }
    return new Response(
      "intinor-cron-poll: no UI here. It calls /api/cron/poll on a Cron Trigger; " +
        "GET /__scheduled to trigger it manually for testing.",
    );
  },
} satisfies ExportedHandler<Env>;
