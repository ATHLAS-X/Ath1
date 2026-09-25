/**
 * fetch() + response.json() that fails loudly instead of throwing
 * "Unexpected end of JSON input" on a non-2xx response with an empty or
 * non-JSON body (401/403/500 from requireAuth() and friends all do this).
 */
export async function fetchJSON<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${typeof input === 'string' ? input : String(input)} failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}
