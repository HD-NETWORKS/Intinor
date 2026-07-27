/**
 * Read/write values at a dot+bracket path (`destinations.basic[0].address`)
 * inside a settings object. Writes are immutable — only the objects along the
 * touched path are cloned — so React state updates stay predictable and we
 * never mutate the pristine "original" copy we diff against.
 */

export type PathToken = string | number;

export function tokenizePath(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  for (const part of path.split(".")) {
    if (!part) continue;
    const m = part.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (!m) {
      tokens.push(part);
      continue;
    }
    if (m[1]) tokens.push(m[1]);
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) {
      tokens.push(Number(idx[1]));
    }
  }
  return tokens;
}

export function getAtPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const token of tokenizePath(path)) {
    if (cur == null) return undefined;
    cur = (cur as Record<PathToken, unknown>)[token];
  }
  return cur;
}

/** Returns a shallow-cloned copy of `obj` with `path` set to `value`. */
export function setAtPath<T>(obj: T, path: string, value: unknown): T {
  const tokens = tokenizePath(path);
  if (tokens.length === 0) return obj;

  function write(node: unknown, i: number): unknown {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;

    // Materialize a container matching the token type when one is missing.
    const container: unknown =
      node == null ? (typeof token === "number" ? [] : {}) : node;

    if (Array.isArray(container)) {
      const next = [...container];
      next[token as number] = isLast ? value : write(next[token as number], i + 1);
      return next;
    }
    const next = { ...(container as Record<PathToken, unknown>) };
    next[token] = isLast ? value : write(next[token], i + 1);
    return next;
  }

  return write(obj, 0) as T;
}
