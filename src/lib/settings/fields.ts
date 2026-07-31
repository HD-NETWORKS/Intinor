/**
 * Declarative field specs. A page describes *which* settings paths it edits;
 * the shared machinery then handles rendering, permission gating, diffing, and
 * building the PUT body. Keeping the paths in one declared list (rather than
 * deep-diffing whole objects) means the confirmation dialog always has a
 * human label for every change it reports.
 */

import type { ReactNode } from "react";

export type FieldKind = "text" | "number" | "select" | "checkbox" | "password";

export interface SelectOption {
  value: string;
  label: string;
  /** Marks an option as present-but-unavailable (e.g. an offline input). */
  unavailable?: boolean;
}

export interface FieldSpec {
  /** Settings path, e.g. `destinations.basic[0].address`. */
  path: string;
  label: string;
  kind: FieldKind;
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
  /** Shown under the field. */
  help?: string;
  /** Unit suffix for display in the confirm diff, e.g. "ms". */
  unit?: string;
}

export interface FieldSection {
  title: string;
  description?: string;
  fields: FieldSpec[];
  /** Rendered in the section header, right-aligned — e.g. an "Add"/"Remove" button for a resizable array. */
  headerExtra?: ReactNode;
}

/** Human-readable rendering of a value for the confirmation diff. */
export function displayValue(spec: FieldSpec, value: unknown): string {
  if (value === undefined || value === null || value === "") return "(empty)";
  if (spec.kind === "checkbox") return value ? "on" : "off";
  if (spec.kind === "password") return "••••••";
  if (spec.kind === "select") {
    const opt = spec.options?.find((o) => o.value === String(value));
    return opt ? opt.label : String(value);
  }
  return spec.unit ? `${value} ${spec.unit}` : String(value);
}
