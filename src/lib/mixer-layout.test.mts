import {
  buildPresetLayers,
  clamp,
  clampLayout,
  isFeedSource,
  PRESETS,
  prepareMixerPut,
  round3,
  slotCoverage,
  stripEnabled,
  withEnabled,
} from "./mixer-layout.ts";
import type { VideoMixerLayerSettings, VideoMixerSettingsResponse } from "./intinor/types.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label}`);
}

// --- clamp / round3 ---
eq(clamp(0.5, 0, 1), 0.5, "clamp passes through an in-range value");
eq(clamp(-0.2, 0, 1), 0, "clamp floors below the minimum");
eq(clamp(1.5, 0, 1), 1, "clamp ceils above the maximum");
eq(round3(0.123456), 0.123, "round3 rounds to three decimals");
eq(round3(1), 1, "round3 leaves whole numbers alone");

// --- clampLayout ---
eq(
  clampLayout({ x: 0.1234567, y: 0.5, zoom: 0.5 }),
  { x: 0.123, y: 0.5, zoom: 0.5 },
  "clampLayout rounds every field to three decimals",
);
eq(
  clampLayout({ x: -5, y: 5, zoom: 10 }),
  { x: -1, y: 1, zoom: 2 },
  "clampLayout clamps to the default x/y/zoom bounds",
);
eq(
  clampLayout(
    { x: 0.9, y: 0.9, zoom: 0.9 },
    { x: { min: 0, max: 0.5 }, y: { min: 0, max: 0.5 }, zoom: { min: 0.1, max: 0.5 } },
  ),
  { x: 0.5, y: 0.5, zoom: 0.5 },
  "clampLayout respects unit-supplied constraints over the defaults",
);

// --- isFeedSource ---
eq(isFeedSource("/network_inputs/0"), true, "a network input is a feed source");
eq(isFeedSource("/video_inputs/3"), true, "a video (Netvideo) input is a feed source");
eq(isFeedSource("/test_picture"), false, "test picture is not a feed source");
eq(isFeedSource(undefined), false, "no source is not a feed source");

// --- slotCoverage ---
const layers: VideoMixerLayerSettings[] = [
  { layout: { x: 0, y: 0, zoom: 1 }, input: { source: "/network_inputs/0" } },
  { layout: { x: 0, y: 0, zoom: 1 }, input: { source: "/network_inputs/1" } },
  { layout: { x: 0, y: 0, zoom: 1 }, input: { source: "/test_picture" } },
  { layout: { x: 0, y: 0, zoom: 1 }, input: { source: "" } },
];
eq(
  slotCoverage(layers, new Set(["/network_inputs/0"])),
  { total: 4, liveFeeds: 1, fillers: 2, empty: 1 },
  "slotCoverage separates live feeds, fillers (incl. offline feed sources), and empty slots",
);

// --- buildPresetLayers ---
const quad = PRESETS.find((p) => p.id === "quad")!;
const built = buildPresetLayers(quad, ["/network_inputs/0"], "/test_picture");
eq(built.length, 4, "buildPresetLayers produces one layer per preset slot");
eq(built[0].input.source, "/network_inputs/0", "the one available feed fills the first slot");
eq(
  [built[1].input.source, built[2].input.source, built[3].input.source],
  ["/test_picture", "/test_picture", "/test_picture"],
  "remaining slots fall back to the filler — never an invented feed",
);
eq(built[0].layout, quad.layouts[0], "each slot's layout matches the preset definition");

const noFeeds = buildPresetLayers(quad, [], "/test_picture");
eq(
  noFeeds.every((l) => l.input.source === "/test_picture"),
  true,
  "with zero available feeds every slot is a filler",
);

// --- withEnabled / stripEnabled ---
const rawLayers: VideoMixerLayerSettings[] = [
  { layout: { x: 0, y: 0, zoom: 1 }, input: { source: "/network_inputs/0" } },
];
const editable = withEnabled(rawLayers);
eq(editable[0].enabled, true, "layers loaded from the unit default to enabled");
const preDisabled = withEnabled(
  [{ ...rawLayers[0], enabled: false }] as unknown as VideoMixerLayerSettings[],
);
eq(preDisabled[0].enabled, false, "withEnabled respects an already-present enabled flag");
const stripped = stripEnabled(editable);
eq(
  stripped[0],
  { layout: rawLayers[0].layout, input: rawLayers[0].input },
  "stripEnabled drops the dashboard-only flag, keeping only layout/input",
);

// --- prepareMixerPut ---
const current: VideoMixerSettingsResponse = {
  description: "Program mix",
  active: true,
  video_sources: [],
  video_out: { sd_aspect_ratio: "16:9" },
  program: { layers: [{ layout: { x: 0, y: 0, zoom: 1 }, input: { source: "/test_picture" } }] },
  layout_profiles: [{ layers: [{ layout: { x: 0, y: 0, zoom: 1 } }] }],
  _constraints: { capabilities: { deactivatable: false }, mutable: ["*"] },
  _messages: [],
  _links: [],
};
const newLayers: VideoMixerLayerSettings[] = [
  { layout: { x: 0, y: 0, zoom: 0.5 }, input: { source: "/network_inputs/0" } },
  { layout: { x: 0.5, y: 0, zoom: 0.5 }, input: { source: "/network_inputs/1" } },
];
const putBody = prepareMixerPut(current, newLayers);
eq(putBody.program?.layers, newLayers, "prepareMixerPut replaces program.layers with the new layers");
eq(
  putBody.layout_profiles,
  current.layout_profiles,
  "prepareMixerPut preserves existing layout_profiles untouched",
);
eq(
  ["_constraints", "_messages", "_links"].every((k) => !(k in putBody)),
  true,
  "prepareMixerPut strips _constraints/_messages/_links",
);
eq(
  current.program?.layers[0].input.source,
  "/test_picture",
  "prepareMixerPut does not mutate the original settings object",
);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
