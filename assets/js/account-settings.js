// Account settings: self-service password change.
//
// The server verifies the current password on every change and scopes each
// update to the signed-in user's own row, so this UI can only ever edit the
// account that is logged in. Email addresses are immutable by design: no
// endpoint exists to change any email, for any user, including the admin.
import { api } from "./api.js";
import { isAuthenticated } from "./auth.js";

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Same inline-field-error pattern as checkout.js: the message is attached to the
// field's own label so the customer sees which input to fix.
function fieldError(el, message) {
  const holder = el.closest("label") || el.parentElement;
  let note = holder.querySelector(".field-error");
  if (!message) {
    note?.remove();
    el.removeAttribute("aria-invalid");
    return;
  }
  if (!note) {
    note = document.createElement("small");
    note.className = "field-error muted";
    holder.appendChild(note);
  }
  note.textContent = message;
  el.setAttribute("aria-invalid", "true");
}

const inputStyle = "border-radius:13px;border:1px solid var(--border);background:rgba(15,23,42,.7);color:var(--text);padding:12px";

function panelHtml() {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;align-items:start;margin-top:18px">
      <form data-password-form class="soft-panel" style="padding:22px;display:grid;gap:12px" novalidate>
        <h2 style="margin:0">Change password</h2>
        <label style="display:grid;gap:7px"><strong>Current password</strong>
          <input name="current_password" type="password" required autocomplete="current-password" style="${inputStyle}">
        </label>
        <label style="display:grid;gap:7px"><strong>New password</strong>
          <input name="new_password" type="password" required minlength="8" maxlength="256" autocomplete="new-password" style="${inputStyle}">
        </label>
        <label style="display:grid;gap:7px"><strong>Repeat new password</strong>
          <input name="confirm" type="password" required autocomplete="new-password" style="${inputStyle}">
        </label>
        <p class="form-message" data-password-msg aria-live="polite"></p>
        <button class="btn btn-primary" type="submit" data-password-submit>Update password</button>
      </form>
    </div>`;
}
export async function renderAccountSettings() {
  const mount = document.querySelector("#account-settings");
  if (!mount || !window.location.pathname.endsWith("account.html")) return;

  // This module self-starts alongside app.js, so for a visitor it runs while
  // requireLogin()'s redirect is still in flight. Asking /auth/me here would
  // print one last 401 in the console on the way out.
  if (!(await isAuthenticated())) return;

  const me = await api("/auth/me").catch(() => null);
  if (!me) return; // requireLogin() in app.js already handles the redirect.

  mount.innerHTML = panelHtml();

  const pwForm = mount.querySelector("[data-password-form]");
  const pwMsg = mount.querySelector("[data-password-msg]");
  const pwSubmit = mount.querySelector("[data-password-submit]");

  pwForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    pwMsg.textContent = "";
    const data = new FormData(pwForm);
    const current = String(data.get("current_password") ?? "");
    const next = String(data.get("new_password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    fieldError(pwForm.elements.new_password, next.length >= 8 ? "" : "Use at least 8 characters");
    fieldError(pwForm.elements.confirm, confirm === next ? "" : "Passwords do not match");
    if (next.length < 8 || confirm !== next) {
      pwMsg.textContent = "Please fix the highlighted fields.";
      return;
    }
    pwSubmit.disabled = true;
    pwSubmit.textContent = "Updating…";
    try {
      const res = await api("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next }) });
      pwMsg.textContent = res.message || "Password updated.";
      pwForm.reset();
    } catch (err) {
      pwMsg.textContent = escHtml(err.message || "Could not update the password.");
    } finally {
      pwSubmit.disabled = false;
      pwSubmit.textContent = "Update password";
    }
  });
}

renderAccountSettings();

