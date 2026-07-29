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
  EncoderStatus,
  NetworkInput,
  NetworkInputsList,
  NetworkInputStatus,
  VideoMixersList,
  VideoMixerSettingsResponse,
  VideoSourceConstraint,
} from "../types";
import {
  mockEncoder,
  mockEncoderStatus,
  mockNetworkInput,
  mockNetworkInputStatus,
  mockVideoMixersList,
  mockVideoMixerSettings,
} from "./data";
import { clamp, jitteredValue } from "./jitter";

export const BIG_INPUT_COUNT = 16;
export const BIG_ENCODER_COUNT = 17;

// A sparse "only a few pipes are actually patched right now" pattern — most
// real racks look like this far more often than every slot being live.
const LIVE_INPUTS = new Set([0, 6, 11]);
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

/** One mixer is enough to demonstrate the pattern — real counts always come from the unit's own API. */
export function bigVideoMixersList(): VideoMixersList {
  return structuredClone(mockVideoMixersList);
}

/**
 * The mixer's settings/constraints, with `_constraints.program.layers.input.source`
 * expanded to list all BIG_INPUT_COUNT synthetic inputs. The default mock only
 * lists network_inputs/0 — correct for the 1-input unit, but it would make
 * every other input on this fixture unselectable as a mixer source, which
 * defeats the point of testing at this unit's actual scale.
 */
export function bigVideoMixerSettings(): VideoMixerSettingsResponse {
  const base = structuredClone(mockVideoMixerSettings);
  const testPicture = base._constraints!.program!.layers.input!.source.find((s) =>
    s.value?.includes("test_picture"),
  );
  const inputSources: VideoSourceConstraint[] = Array.from({ length: BIG_INPUT_COUNT }, (_, i) => ({
    name: `Network input ${i + 1}`,
    value: bigNetworkInput(i).href,
    description: `IP stream in ${i + 1}`,
    multiprogram: true,
  }));
  return {
    ...base,
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
