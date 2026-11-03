// Exp 5 - the one place that talks to the Express + MongoDB API (sinchai-server).
// Every call goes through request(), which adds the JWT, turns a failed response into an ApiError and
// reports "server not reachable" as status 0, so the screens can show a useful message instead of a blank page.
// In development Vite proxies /api to http://localhost:3000 (vite.config.js); VITE_API_URL points a production build elsewhere.
const BASE = import.meta.env.VITE_API_URL ?? "/api";

// localStorage key of the saved session: { user, token }
export const SESSION_KEY = "sinchai.session";

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || "Request failed");
    this.status = status; // 0 = no answer from the server at all
    this.fields = body?.fields || {}; // { email: "Email is already registered", ... } for forms
    this.details = body?.details || [];
  }
}

function savedToken() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))?.token ?? null;
  } catch {
    return null; // storage disabled / corrupt value: behave as logged out
  }
}

async function request(method, path, body) {
  const headers = {};
  const token = savedToken();
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, { error: "Cannot reach the server" });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* an empty or non-JSON body: data stays null */
  }
  if (!res.ok) {
    // a saved token the server no longer accepts (expired, account deleted): AppContext listens and logs out
    if (res.status === 401 && token) window.dispatchEvent(new Event("sinchai:unauthorized"));
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body ?? {}),
  put: (path, body) => request("PUT", path, body ?? {}),
  patch: (path, body) => request("PATCH", path, body ?? {}),
  delete: (path) => request("DELETE", path),
};

// turns an ApiError into the i18n key of a message a farmer can act on
export function errorKey(err) {
  if (!(err instanceof ApiError)) return "errServer";
  if (err.status === 0) return "errNetwork";
  if (err.status === 429) return "errTooMany";
  if (err.status === 401) return "errLoginFailed";
  return "errServer";
}
