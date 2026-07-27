import "server-only";
import { getUnitConfig } from "./config";
import { getSessionAuthHeader, invalidateSession } from "./session";

/**
 * Authenticated fetch against a live unit, using `username:session_id` Basic
 * Auth. On a 401 the cached session is dropped and the request is retried
 * once with a fresh session. `unitId` selects which configured unit to talk
 * to (see server/config.ts) — nothing here assumes there's only one.
 */
export async function unitFetch(
  unitId: string,
  unitPath: string,
  init: {
    method?: string;
    body?: string;
    contentType?: string;
    search?: string;
    ifNoneMatch?: string;
  } = {},
): Promise<Response> {
  const { baseUrl } = getUnitConfig(unitId);
  const path = unitPath.replace(/^\/+/, "");
  const url = `${baseUrl}/${path}${init.search ?? ""}`;

  const doFetch = async (): Promise<Response> =>
    fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: await getSessionAuthHeader(unitId),
        "X-No-Basic-Auth": "1",
        ...(init.body ? { "Content-Type": init.contentType ?? "application/json" } : {}),
        ...(init.ifNoneMatch ? { "If-None-Match": init.ifNoneMatch } : {}),
      },
      body: init.body,
      cache: "no-store",
    });

  let res = await doFetch();
  if (res.status === 401) {
    invalidateSession(unitId);
    res = await doFetch();
  }
  return res;
}
