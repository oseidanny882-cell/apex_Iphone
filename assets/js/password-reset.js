import { api } from "./api.js";

// Password reset flow: request a code (forgot-password.html), confirm it
// (verify.html), then set a new password (reset-password.html). The API never
// echoes the code back, so it is held in sessionStorage between steps only while
// the user completes the flow, and cleared as soon as it is consumed.
const PENDING_KEY = "apex.reset.pending";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showMessage(scope, message, isError = true) {
  const el = scope.querySelector("[data-form-message]");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.toggle("success", !isError);
}

function setBusy(form, busy) {
  form.querySelectorAll("input, button").forEach((el) => {
    el.disabled = busy;
  });
}

function remember(email, code) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email, code }));
  } catch {
    /* private mode: the flow still works, the user just retypes the code */
  }
}

function recall() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

function forget() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Step 1 - ask for a reset code.
 * The API answers generically, so the page reports "if an account exists" rather
 * than confirming whether the address is registered.
 */
export function renderForgotPasswordForm() {
  const content = document.querySelector("#content");
  if (!content) return;

  content.innerHTML = `
    <form class="auth-form" data-forgot-form novalidate>
      <span class="section-tag">Account recovery</span>
      <p class="muted">Enter the email you signed up with and we will send a 6-digit reset code. The code expires after 15 minutes.</p>
      <label for="forgot-email">Email</label>
      <input id="forgot-email" name="email" type="email" autocomplete="email" required />
      <p class="form-message" data-form-message aria-live="polite"></p>
      <button class="btn btn-primary" type="submit">Send reset code</button>
      <p class="muted"><a href="login.html">Back to log in</a></p>
    </form>
  `;

  const form = content.querySelector("[data-forgot-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.email.value.trim();
    if (!email) {
      showMessage(form, "Enter your email address.", true);
      return;
    }

    setBusy(form, true);
    showMessage(form, "Sending...", false);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      remember(email, "");
      // Show the success message and give the user a moment to read it before
      // navigating away; jumping straight to verify.html made "Sending..." the
      // last thing on screen even though the request had already succeeded.
      showMessage(form, "If an account exists for that email, a reset code has been sent. Check your inbox — it may take a few seconds.", false);
      window.setTimeout(() => {
        window.location.href = `verify.html?email=${encodeURIComponent(email)}`;
      }, 900);
    } catch (error) {
      showMessage(form, error.message, true);
      setBusy(form, false);
    }
  });
}

/** Step 2 - confirm the code. A verified code is what unlocks step 3. */
export function renderVerifyCodeForm() {
  const content = document.querySelector("#content");
  if (!content) return;

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || recall()?.email || "";

  content.innerHTML = `
    <form class="auth-form" data-verify-form novalidate>
      <span class="section-tag">Account recovery</span>
      <p class="muted">Enter the 6-digit code sent to <strong>${esc(email) || "your email"}</strong>. It expires after 15 minutes.</p>
      <label for="verify-email">Email</label>
      <input id="verify-email" name="email" type="email" autocomplete="email" value="${esc(email)}" required />
      <label for="verify-code">Reset code</label>
      <input id="verify-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required />
      <p class="form-message" data-form-message aria-live="polite"></p>
      <button class="btn btn-primary" type="submit">Verify code</button>
      <p class="muted"><a href="forgot-password.html">Send a new code</a> · <a href="login.html">Back to log in</a></p>
    </form>
  `;

  const form = content.querySelector("[data-verify-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittedEmail = form.email.value.trim();
    const code = form.code.value.trim();
    if (!submittedEmail || !/^\d{6}$/.test(code)) {
      showMessage(form, "Enter your email and the 6-digit code.", true);
      return;
    }

    setBusy(form, true);
    showMessage(form, "Checking...", false);
    try {
      await api("/auth/verify-reset-code", {
        method: "POST",
        body: JSON.stringify({ email: submittedEmail, code })
      });
      remember(submittedEmail, code);
      window.location.href = `reset-password.html?email=${encodeURIComponent(submittedEmail)}`;
    } catch (error) {
      showMessage(form, error.message, true);
      setBusy(form, false);
    }
  });
}

/** Step 3 - set the new password and consume the code. */
export function renderResetPasswordForm() {
  const content = document.querySelector("#content");
  if (!content) return;

  const params = new URLSearchParams(window.location.search);
  const pending = recall();
  const email = params.get("email") || pending?.email || "";

  content.innerHTML = `
    <form class="auth-form" data-reset-form novalidate>
      <span class="section-tag">Account recovery</span>
      <p class="muted">Choose a new password for <strong>${esc(email) || "your account"}</strong>. Use at least 8 characters.</p>
      <label for="reset-email">Email</label>
      <input id="reset-email" name="email" type="email" autocomplete="email" value="${esc(email)}" required />
      <label for="reset-code">Reset code</label>
      <input id="reset-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" value="${esc(pending?.code || "")}" required />
      <label for="reset-new-password">New password</label>
      <input id="reset-new-password" name="new_password" type="password" autocomplete="new-password" minlength="8" required />
      <label for="reset-confirm-password">Confirm new password</label>
      <input id="reset-confirm-password" name="confirm_password" type="password" autocomplete="new-password" minlength="8" required />
      <p class="form-message" data-form-message aria-live="polite"></p>
      <button class="btn btn-primary" type="submit">Set new password</button>
      <p class="muted"><a href="forgot-password.html">Send a new code</a> · <a href="login.html">Back to log in</a></p>
    </form>
  `;

  const form = content.querySelector("[data-reset-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittedEmail = form.email.value.trim();
    const code = form.code.value.trim();
    const newPassword = form.new_password.value;

    if (!submittedEmail || !/^\d{6}$/.test(code)) {
      showMessage(form, "Enter your email and the 6-digit code.", true);
      return;
    }
    if (newPassword.length < 8) {
      showMessage(form, "Password must be at least 8 characters.", true);
      return;
    }
    if (newPassword !== form.confirm_password.value) {
      showMessage(form, "Those passwords do not match.", true);
      return;
    }

    setBusy(form, true);
    showMessage(form, "Saving...", false);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: submittedEmail, code, new_password: newPassword })
      });
      forget();
      showMessage(form, "Password updated. Taking you to the login page...", false);
      window.setTimeout(() => {
        window.location.href = `login.html?reset=1&email=${encodeURIComponent(submittedEmail)}`;
      }, 1200);
    } catch (error) {
      showMessage(form, error.message, true);
      setBusy(form, false);
    }
  });
}