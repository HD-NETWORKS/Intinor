import { diffSettings } from "./diff.ts";
import type { FieldSpec } from "./fields.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label}`);
}

// --- basic field changes ---
const textSpec: FieldSpec = { path: "description", label: "Description", kind: "text" };
eq(
  diffSettings({ description: "old" }, { description: "old" }, [textSpec]),
  [],
  "identical values produce no change",
);
eq(
  diffSettings({ description: "old" }, { description: "new" }, [textSpec]),
  [{ path: "description", label: "Description", from: "old", to: "new", value: "new" }],
  "a changed text field carries path/label/from/to/value",
);

// --- empty/undefined equivalence ---
eq(
  diffSettings({ note: undefined }, { note: "" }, [{ path: "note", label: "Note", kind: "text" }]),
  [],
  "undefined and empty string are treated as equal",
);

// --- checkbox/select display formatting ---
const checkboxSpec: FieldSpec = { path: "active", label: "Active", kind: "checkbox" };
eq(
  diffSettings({ active: false }, { active: true }, [checkboxSpec]),
  [{ path: "active", label: "Active", from: "off", to: "on", value: true }],
  "checkbox values render as on/off",
);

const selectSpec: FieldSpec = {
  path: "mode",
  label: "Mode",
  kind: "select",
  options: [
    { value: "a", label: "Mode A" },
    { value: "b", label: "Mode B" },
  ],
};
eq(
  diffSettings({ mode: "a" }, { mode: "b" }, [selectSpec]),
  [{ path: "mode", label: "Mode", from: "Mode A", to: "Mode B", value: "b" }],
  "select values render their option label",
);

// --- array resize collapses per-field diffs into one structural change ---
const destSpecs: FieldSpec[] = [
  { path: "destinations.basic[0].address", label: "Address", kind: "text" },
  { path: "destinations.basic[0].port", label: "Port", kind: "number" },
];
const before = { destinations: { basic: [{ address: "1.1.1.1", port: 1000 }] } };
const after = {
  destinations: {
    basic: [
      { address: "1.1.1.1", port: 9999 },
      { address: "2.2.2.2", port: 2000 },
    ],
  },
};
const resizedChanges = diffSettings(before, after, destSpecs);
eq(
  resizedChanges,
  [
    {
      path: "destinations.basic",
      label: "Push destinations",
      from: "1 item(s)",
      to: "2 item(s)",
      value: after.destinations.basic,
    },
  ],
  "an added array item collapses to one structural change, using the friendly array label",
);
eq(
  resizedChanges.some((c) => c.path === "destinations.basic[0].port"),
  false,
  "the structural change supersedes the per-field port change it also detected",
);

// --- unresized array still reports ordinary per-field changes ---
const sameLengthAfter = {
  destinations: { basic: [{ address: "1.1.1.1", port: 5000 }] },
};
eq(
  diffSettings(before, sameLengthAfter, destSpecs),
  [{ path: "destinations.basic[0].port", label: "Port", from: "1000", to: "5000", value: 5000 }],
  "a same-length array reports the individual field change, not a structural one",
);

// --- unknown array path falls back to a titleized last segment ---
const customSpecs: FieldSpec[] = [{ path: "custom_rules[0].name", label: "Name", kind: "text" }];
eq(
  diffSettings({ custom_rules: [{ name: "a" }] }, { custom_rules: [] }, customSpecs)[0].label,
  "Custom Rules",
  "unknown array path falls back to a titleized last path segment",
);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
