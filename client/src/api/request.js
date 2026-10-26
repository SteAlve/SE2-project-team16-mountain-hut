/**
 * Shared fetch wrapper: every call to the server goes through `request`.
 * Any failure (error status or unreachable server) becomes an ApiError.
 */

export class ApiError extends Error {
  constructor(status, error, message) {
    super(message);
    this.status = status; // 0 when the server cannot be reached
    this.error = error; // error name sent by the server, e.g. 'ConflictError'
  }
}

export async function request(path, options) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch {
    throw new ApiError(0, 'NetworkError', 'Unable to reach the server');
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? 'RequestFailed',
      body?.message ?? 'Request failed',
    );
  }
  return body;
}
