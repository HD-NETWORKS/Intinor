import "server-only";
import { getUnitConfig } from "./config";
import { getSessionAuthHeader, invalidateSession } from "./session";

/**
 * Authenticated fetch against the live unit, using `username:session_id`
 * Basic Auth. On a 401 the cached session is dropped and the request is
 * retried once with a fresh session.
 */
export async function unitFetch(
  unitPath: string,
  init: {
    method?: string;
    body?: string;
    contentType?: string;
    search?: string;
    ifNoneMatch?: string;
  } = {},
): Promise<Response> {
  const { baseUrl } = getUnitConfig();
  const path = unitPath.replace(/^\/+/, "");
  const url = `${baseUrl}/${path}${init.search ?? ""}`;

  const doFetch = async (): Promise<Response> =>
    fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: await getSessionAuthHeader(),
        "X-No-Basic-Auth": "1",
        ...(init.body ? { "Content-Type": init.contentType ?? "application/json" } : {}),
        ...(init.ifNoneMatch ? { "If-None-Match": init.ifNoneMatch } : {}),
      },
      body: init.body,
      cache: "no-store",
    });

  let res = await doFetch();
  if (res.status === 401) {
    invalidateSession();
    res = await doFetch();
  }
  return res;
}
