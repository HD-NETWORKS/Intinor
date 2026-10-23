/**
 * `next` comes straight from an attacker-controlled query string — anyone
 * can craft and send `/login?next=...` directly, bypassing the one place
 * (proxy.ts) that ever *writes* a safe same-origin value here. Only a
 * single-segment relative path is safe to redirect to after a real login.
 *
 * Rejects a protocol-relative `//evil.com` (browsers treat a leading `//`
 * as an absolute URL to a different host, not a path) and a backslash
 * variant (`/\evil.com`, which some browsers normalize to `//evil.com`
 * too), along with any absolute URL — an unvalidated post-login redirect
 * is a classic open-redirect phishing vector.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
