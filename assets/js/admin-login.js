import { API_BASE } from "./config.js";
const form = document.querySelector("#admin-login-form");
const msg = document.querySelector("[data-msg]");
if (new URLSearchParams(window.location.search).get("denied")) {
  if (msg) msg.textContent = "Access denied.";
}
// The reset flow returns here with ?reset=1 after the password has been changed.
if (new URLSearchParams(window.location.search).get("reset")) {
  if (msg) {
    msg.textContent = "Password updated. Log in with your new password.";
    msg.classList.add("success");
  }
}
try {
  const r = await fetch(API_BASE + "/admin/me", { credentials: "include" });
  if (r.ok) window.location.href = "products.html";
} catch {}
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  if (msg) msg.textContent = "Signing in...";
  try {
    const r = await fetch(API_BASE + "/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || "Invalid email or password");
    const meRes = await fetch(API_BASE + "/admin/me", { credentials: "include" });
    if (!meRes.ok) {
      await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
      throw new Error("Access denied.");
    }
    window.location.href = "products.html";
  } catch (err) {
    if (msg) msg.textContent = err.message;
    btn.disabled = false;
  }
});
