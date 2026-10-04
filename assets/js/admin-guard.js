import { API_BASE } from "./config.js";
async function req(path, options = {}) {
  const r = await fetch(API_BASE + path, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    // A 422 carries the offending fields in `errors`; `detail` is a readable
    // summary. Prefer whichever the server sent, and never surface a raw object.
    const fields = Array.isArray(d.errors) && d.errors.length
      ? d.errors.map((e) => {
          const f = (e.loc || []).slice(1).join(".") || "request";
          return `${f}: ${e.msg || "invalid"}`;
        })
      : null;
    const err = new Error(
      fields ? fields.join("; ") : (Array.isArray(d.detail) ? "Request failed" : d.detail) || "Request failed"
    );
    err.status = r.status;
    throw err;
  }
  return d;
}
export async function requireAdmin() {
  let me = null;
  try {
    me = await req("/admin/me");
  } catch (e) {
    await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    window.location.href = "login.html";
    throw e;
  }
  if (!me || me.role !== "admin") {
    await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    window.location.href = "login.html?denied=1";
    throw new Error("Access denied");
  }
  return me;
}
export { req as adminApi };
