import {
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLogin,
  resetRateLimitState,
} from "./rate-limit.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label}`);
}

resetRateLimitState();
eq(isLoginRateLimited("1.2.3.4"), false, "a key with no recorded attempts is not rate limited");

for (let i = 0; i < 9; i++) recordFailedLogin("1.2.3.4");
eq(isLoginRateLimited("1.2.3.4"), false, "9 failures (one under the threshold) does not yet block");

recordFailedLogin("1.2.3.4");
eq(isLoginRateLimited("1.2.3.4"), true, "the 10th failure in the window blocks further attempts");

eq(isLoginRateLimited("5.6.7.8"), false, "a different key is tracked independently");

clearLoginAttempts("1.2.3.4");
eq(isLoginRateLimited("1.2.3.4"), false, "clearing attempts (a successful login) lifts the block");

resetRateLimitState();
console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
