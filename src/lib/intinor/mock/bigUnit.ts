/**
 * Synthetic "big" unit — for testing the dashboard's unit switcher and dense
 * list view at real-world scale (e.g. a 16-input/17-encoder rack unit)
 * without needing that hardware in front of you.
 *
 * Any mock unit id other than the primary one (INTINOR_UNIT_ID, default
 * "D01393") gets this fixture instead of the single-pipe default. Add a
 * second entry to INTINOR_UNITS in mock mode to try it:
 *
 *   MOCK=1 INTINOR_UNITS='[{"id":"D01796","host":"mock","username":"mock","password":"mock","label":"HD networks 17 ch"}]' npm run dev
 *
 * Then pick it from the unit switcher in the header.
 */

import type {
  Encoder,
  EncodersList,
  EncoderSettingsResponse,
  EncoderStatus,
  NetworkInput,
  NetworkInputsList,
  NetworkInputStatus,
  VideoInput,
  VideoInputsList,
  VideoInputStatus,
  VideoMixer,
  VideoMixersList,
  VideoMixerSettingsResponse,
  VideoSourceConstraint,
} from "../types";
import {
  mockEncoder,
  mockEncoderSettings,
  mockEncoderStatus,
  mockNetworkInput,
  mockNetworkInputStatus,
  mockVideoInput,
  mockVideoInputStatus,
  mockVideoMixer,
  mockVideoMixerSettings,
} from "./data";
import { clamp, jitteredValue } from "./jitter";

export const BIG_INPUT_COUNT = 16;
export const BIG_VIDEO_INPUT_COUNT = 16;
export const BIG_ENCODER_COUNT = 17;
/** Two mixers, so the multi-mixer picker and cross-mixer usage indicators are actually exercisable. */
export const BIG_MIXER_COUNT = 2;

// A sparse "only a few pipes are actually patched right now" pattern — most
// real racks look like this far more often than every slot being live.
const LIVE_INPUTS = new Set([0, 6, 11]);
const LIVE_VIDEO_INPUTS = new Set([2, 8]);
const LIVE_ENCODERS = new Set([0, 4, 9, 15]);

export function bigNetworkInputsList(): NetworkInputsList {
  return { network_inputs: Array.from({ length: BIG_INPUT_COUNT }, (_, i) => bigNetworkInput(i)) };
}

export function bigNetworkInput(index: number): NetworkInput {
  return {
    ...structuredClone(mockNetworkInput),
    index,
    description: `IP stream in ${index + 1}`,
    active: LIVE_INPUTS.has(index),
    href: mockNetworkInput.href.replace(/\/0$/, `/${index}`),
  };
}

export function bigNetworkInputStatus(index: number): NetworkInputStatus {
  const base = structuredClone(mockNetworkInputStatus);
  const live = LIVE_INPUTS.has(index);
  if (!live) {
    return {
      ...base,
      active: false,
      description: `IP stream in ${index + 1}`,
      network_source: { ...base.network_source, bitrate: 0, packet_loss: undefined, programs: [] },
    };
  }
  const bitrate = Math.round(
    clamp(jitteredValue(`big-ni-${index}`, 3_000_000, 400_000), 500_000, Infinity),
  );
  return {
    ...base,
    active: true,
    description: `IP stream in ${index + 1}`,
    network_source: { ...base.network_source, bitrate },
  };
}

export function bigVideoInputsList(): VideoInputsList {
  return { video_inputs: Array.from({ length: BIG_VIDEO_INPUT_COUNT }, (_, i) => bigVideoInput(i)) };
}

export function bigVideoInput(index: number): VideoInput {
  return {
    ...structuredClone(mockVideoInput),
    index,
    description: `Netvideo in ${index + 1}`,
    active: LIVE_VIDEO_INPUTS.has(index),
    href: mockVideoInput.href.replace(/\/0$/, `/${index}`),
  };
}

export function bigVideoInputStatus(index: number): VideoInputStatus {
  const base = structuredClone(mockVideoInputStatus);
  const live = LIVE_VIDEO_INPUTS.has(index);
  if (!live) {
    return {
      ...base,
      active: false,
      description: `Netvideo in ${index + 1}`,
      netvideo_source: { ...base.netvideo_source, srt: undefined },
      video_in: base.video_in ? { ...base.video_in, available: false } : base.video_in,
    };
  }
  const bitrate = Math.round(
    clamp(jitteredValue(`big-vi-${index}`, 4_000_000, 400_000), 500_000, Infinity),
  );
  return {
    ...base,
    active: true,
    description: `Netvideo in ${index + 1}`,
    netvideo_source: {
      ...base.netvideo_source,
      srt: base.netvideo_source.srt ? { ...base.netvideo_source.srt, bitrate } : base.netvideo_source.srt,
    },
  };
}

export function bigEncodersList(): EncodersList {
  return { encoders: Array.from({ length: BIG_ENCODER_COUNT }, (_, i) => bigEncoder(i)) };
}

export function bigEncoder(index: number): Encoder {
  return {
    ...structuredClone(mockEncoder),
    index,
    description: `Encoder ${index + 1}`,
    active: LIVE_ENCODERS.has(index),
    href: mockEncoder.href.replace(/\/0$/, `/${index}`),
  };
}

export function bigEncoderStatus(index: number): EncoderStatus {
  const base = structuredClone(mockEncoderStatus);
  const live = LIVE_ENCODERS.has(index);
  if (!live) {
    return {
      ...base,
      active: false,
      description: `Encoder ${index + 1}`,
      encoding: { ...base.encoding, total_bitrate: 0 },
      destinations: { ...base.destinations, basic: [] },
    };
  }
  const bitrate = Math.round(
    clamp(jitteredValue(`big-enc-${index}`, 5_000_000, 500_000), 500_000, Infinity),
  );
  return {
    ...base,
    active: true,
    description: `Encoder ${index + 1}`,
    encoding: { ...base.encoding, total_bitrate: bitrate },
  };
}

export function bigVideoMixer(index: number): VideoMixer {
  return {
    ...structuredClone(mockVideoMixer),
    index,
    description: index === 0 ? "Program mix" : `Mixer ${index + 1}`,
    href: mockVideoMixer.href.replace(/\/0$/, `/${index}`),
  };
}

/** Two mixers — real counts always come from the unit's own API. */
export function bigVideoMixersList(): VideoMixersList {
  return { video_mixers: Array.from({ length: BIG_MIXER_COUNT }, (_, i) => bigVideoMixer(i)) };
}

function bigInputSourceOptions(): VideoSourceConstraint[] {
  return Array.from({ length: BIG_INPUT_COUNT }, (_, i) => ({
    name: `Network input ${i + 1}`,
    value: bigNetworkInput(i).href,
    description: `IP stream in ${i + 1}`,
    multiprogram: true,
  }));
}

/** Netvideo inputs are a distinct resource from network inputs but an equally valid mixer/encoder source. */
function bigVideoInputSourceOptions(): VideoSourceConstraint[] {
  return Array.from({ length: BIG_VIDEO_INPUT_COUNT }, (_, i) => ({
    name: `Netvideo in ${i + 1}`,
    value: bigVideoInput(i).href,
    description: `Netvideo in ${i + 1}`,
  }));
}

/**
 * A mixer's settings/constraints, with `_constraints.program.layers.input.source`
 * expanded to list all BIG_INPUT_COUNT synthetic inputs. The default mock only
 * lists network_inputs/0 — correct for the 1-input unit, but it would make
 * every other input on this fixture unselectable as a mixer source, which
 * defeats the point of testing at this unit's actual scale.
 */
export function bigVideoMixerSettings(index: number): VideoMixerSettingsResponse {
  const base = structuredClone(mockVideoMixerSettings);
  const testPicture = base._constraints!.program!.layers.input!.source.find((s) =>
    s.value?.includes("test_picture"),
  );
  const inputSources = [...bigInputSourceOptions(), ...bigVideoInputSourceOptions()];
  return {
    ...base,
    description: bigVideoMixer(index).description,
    // Only mixer 0 keeps the default's pre-applied 2-layer program; other
    // mixers start empty, same as a freshly-provisioned mixer would.
    program: index === 0 ? base.program : { background: "black", layers: [] },
    _constraints: {
      ...base._constraints!,
      program: {
        ...base._constraints!.program!,
        layers: {
          ...base._constraints!.program!.layers,
          input: { source: testPicture ? [...inputSources, testPicture] : inputSources },
        },
      },
    },
  };
}

/**
 * An encoder's settings/constraints, with `_constraints.video_source.source`
 * expanded to list every input and mixer on this fixture, not just index 0 —
 * an encoder's source can legitimately be any of them.
 */
export function bigEncoderSettings(index: number): EncoderSettingsResponse {
  const base = structuredClone(mockEncoderSettings);
  const testPicture = base._constraints!.video_source!.source.find((s) =>
    s.value?.includes("test_picture"),
  );
  const mixerSources: VideoSourceConstraint[] = Array.from({ length: BIG_MIXER_COUNT }, (_, i) => ({
    name: `Video mixer ${i + 1}`,
    value: bigVideoMixer(i).href,
  }));
  return {
    ...base,
    description: `Encoder ${index + 1}`,
    _constraints: {
      ...base._constraints!,
      video_source: {
        ...base._constraints!.video_source,
        source: [
          ...mixerSources,
          ...bigInputSourceOptions(),
          ...bigVideoInputSourceOptions(),
          ...(testPicture ? [testPicture] : []),
        ],
      },
    },
  };
}
