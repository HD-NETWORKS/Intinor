import { buildPutBody, detectConflicts } from "./apply.ts";
import type { SettingsChange } from "./diff.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label}`);
}

// --- buildPutBody ---
const fresh = {
  description: "old",
  bitrate: 5000,
  _constraints: { mutable: ["description"] },
  _messages: [],
  _links: [],
};
const changes: SettingsChange[] = [
  { path: "description", label: "Description", from: "old", to: "new", value: "new" },
];
const body = buildPutBody(fresh, changes);
eq(body.description, "new", "buildPutBody applies the changed value");
eq(body.bitrate, 5000, "buildPutBody leaves untouched fields as-is");
eq(
  ["_constraints", "_messages", "_links"].every((k) => !(k in body)),
  true,
  "buildPutBody strips _constraints/_messages/_links",
);
eq(fresh.description, "old", "buildPutBody does not mutate its input");

const freshWithArray = { destinations: { basic: [{ address: "1.1.1.1", port: 1000 }] } };
const arrayChanges: SettingsChange[] = [
  { path: "destinations.basic[0].port", label: "Port", from: "1000", to: "2000", value: 2000 },
];
eq(
  buildPutBody(freshWithArray, arrayChanges).destinations.basic[0].port,
  2000,
  "buildPutBody writes through array-indexed paths",
);

// --- detectConflicts ---
const loaded = { description: "old", bitrate: 5000 };
eq(
  detectConflicts(loaded, { description: "old", bitrate: 5000 }, changes),
  [],
  "no conflicts when nothing drifted on the unit",
);

const driftedFresh = { description: "someone else changed this", bitrate: 5000 };
eq(
  detectConflicts(loaded, driftedFresh, changes),
  [
    {
      path: "description",
      label: "Description",
      loaded: "old",
      current: "someone else changed this",
    },
  ],
  "flags a field that drifted underneath the user's draft",
);

eq(
  detectConflicts(loaded, { description: "old", bitrate: 9999 }, changes),
  [],
  "does not flag drift on a path the user didn't change",
);

eq(
  detectConflicts({ description: null }, { description: "now set" }, [
    { path: "description", label: "Description", from: "(empty)", to: "x", value: "x" },
  ]),
  [{ path: "description", label: "Description", loaded: "(empty)", current: "now set" }],
  "a missing/null loaded value formats as (empty)",
);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
