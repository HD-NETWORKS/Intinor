import { safeNextPath } from "./safe-redirect.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label}`);
}

eq(safeNextPath(null), "/", "null falls back to /");
eq(safeNextPath(undefined), "/", "undefined falls back to /");
eq(safeNextPath(""), "/", "empty string falls back to /");
eq(safeNextPath("/encoders"), "/encoders", "a plain relative path passes through");
eq(safeNextPath("/encoders?tab=settings"), "/encoders?tab=settings", "a relative path with a query string passes through");

// --- the actual open-redirect vectors this exists to block ---
eq(safeNextPath("//evil.com"), "/", "protocol-relative // is rejected, not treated as a path");
eq(safeNextPath("///evil.com"), "/", "triple-slash is rejected too");
eq(safeNextPath("/\\evil.com"), "/", "backslash variant (browser-normalized to //) is rejected");
eq(safeNextPath("https://evil.com"), "/", "an absolute URL with a scheme is rejected");
eq(safeNextPath("http://evil.com"), "/", "an absolute http URL is rejected");
eq(safeNextPath("evil.com"), "/", "a schemeless host with no leading slash is rejected");
eq(safeNextPath("javascript:alert(1)"), "/", "a javascript: URL is rejected");

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
