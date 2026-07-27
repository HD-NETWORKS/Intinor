import { isMutable, hasMutableDescendant, permissionMode } from "./mutable.ts";
import { getAtPath, setAtPath } from "./paths.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label}`);
}

// --- wildcard / empty / unknown ---
eq(isMutable("a.b", ["*"]), true, "'*' grants everything");
eq(isMutable("a.b", []), false, "empty list grants nothing");
eq(isMutable("a.b", undefined), false, "missing mutable is fail-safe read-only");

// --- exact + parent cascade ---
const m = ["video_source.source", "video_source.program_id", "destinations[].active"];
eq(isMutable("video_source.source", m), true, "exact match");
eq(isMutable("video_source.fallback", m), false, "sibling not granted");
eq(isMutable("encoding.encoding_mode", m), false, "unrelated path denied");
eq(isMutable("video_source", ["video_source"]), true, "parent listed → itself");
eq(isMutable("video_source.source", ["video_source"]), true, "parent grant cascades to child");
eq(isMutable("video_sources.other", ["video_source"]), false, "prefix must be a path boundary, not substring");

// --- array wildcards ---
eq(isMutable("destinations[0].active", m), true, "indexed path matches []-wildcard");
eq(isMutable("destinations[7].active", m), true, "any index matches");
eq(isMutable("destinations[0].address", m), false, "non-granted field in same array denied");
eq(isMutable("destinations.basic[0].port", ["destinations.basic[].port"]), true, "nested array wildcard");

// --- section probing ---
eq(hasMutableDescendant("video_source", m), true, "section has editable descendants");
eq(hasMutableDescendant("recording", m), false, "section fully read-only");
eq(hasMutableDescendant("destinations", m), true, "array section probed via descendant");

// --- permission mode ---
eq(permissionMode(["*"]), "all", "mode all");
eq(permissionMode([]), "none", "mode none");
eq(permissionMode(undefined), "unknown", "mode unknown");
eq(permissionMode(["a.b"]), "partial", "mode partial");

// --- path get/set ---
const obj = { destinations: { basic: [{ address: "a", port: 1 }, { address: "b", port: 2 }] } };
eq(getAtPath(obj, "destinations.basic[1].address"), "b", "getAtPath nested array");
const updated = setAtPath(obj, "destinations.basic[0].port", 9001);
eq(getAtPath(updated, "destinations.basic[0].port"), 9001, "setAtPath writes");
eq(getAtPath(obj, "destinations.basic[0].port"), 1, "setAtPath does not mutate original");
eq(getAtPath(updated, "destinations.basic[1].address"), "b", "setAtPath preserves siblings");
eq(Array.isArray(getAtPath(updated, "destinations.basic")), true, "arrays stay arrays after set");

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
