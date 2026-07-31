/**
 * Mock permission profiles.
 *
 * The whole settings UI is driven by `_constraints.mutable`, so the
 * restricted case needs to be exercisable without waiting for a real
 * non-admin account on the unit. `MOCK_ROLE` swaps the mutable list the mock
 * reports:
 *
 *   MOCK_ROLE=admin      (default) → ["*"], everything editable
 *   MOCK_ROLE=operator             → a realistic partial grant
 *   MOCK_ROLE=viewer               → [], everything read-only
 *   MOCK_ROLE=unknown              → omits `mutable` entirely, exercising the
 *                                    fail-safe "permissions unknown" path
 *
 * The shapes mirror the dot/bracket syntax in the API docs, e.g.
 * `destinations.basic[].active`.
 */

export type MockRole = "admin" | "operator" | "viewer" | "unknown";

export type MockResource = "encoder" | "network_input" | "video_input" | "video_mixer" | "encoding";

export function mockRole(): MockRole {
  const raw = (process.env.MOCK_ROLE ?? "admin").toLowerCase();
  return raw === "operator" || raw === "viewer" || raw === "unknown"
    ? (raw as MockRole)
    : "admin";
}

/**
 * An operator can run the show — swap sources, flip destinations on and off,
 * retune the mixer layout — but can't re-address outputs or change encoding
 * presets, which are engineering decisions.
 */
const OPERATOR_GRANTS: Record<MockResource, string[]> = {
  encoder: [
    "video_source.source",
    "video_source.program_id",
    "destinations.basic[].active",
    "destinations.basic[].description",
  ],
  network_input: [
    "description",
    "network_sources.srt_caller.active",
    "network_sources.udp_unicast.active",
    "network_sources.udp_unicast.srt.latency",
  ],
  video_input: ["description", "netvideo_source.type", "netvideo_source.audio_select"],
  video_mixer: ["program", "preview", "layout_profiles", "source_profiles"],
  encoding: ["custom_encoding_modes"],
};

/** The `mutable` list the mock should report for a resource, or undefined. */
export function mockMutable(resource: MockResource): string[] | undefined {
  switch (mockRole()) {
    case "viewer":
      return [];
    case "unknown":
      return undefined;
    case "operator":
      return OPERATOR_GRANTS[resource];
    default:
      return ["*"];
  }
}

/**
 * Apply the active role's `mutable` list to a settings response. When the role
 * is `unknown` the key is removed entirely so the UI's fail-safe branch runs.
 */
export function withMockPermissions<T extends { _constraints?: unknown }>(
  settings: T,
  resource: MockResource,
): T {
  if (!settings._constraints) return settings;
  const mutable = mockMutable(resource);
  const constraints = { ...(settings._constraints as Record<string, unknown>) };
  if (mutable === undefined) delete constraints.mutable;
  else constraints.mutable = mutable;
  return { ...settings, _constraints: constraints };
}
