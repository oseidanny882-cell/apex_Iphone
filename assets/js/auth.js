import {api} from "./api.js";

// Account data is user-controlled (email comes from registration) and is rendered
// into innerHTML below, so every value goes through this first.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function getCurrentUser() {
  // One /auth/me per page load: requireLogin, the account profile and the
  // settings panel can all ask for the same user. Every flow that changes the
  // session (login, logout, verification, reset) navigates away, so a settled
  // answer cannot go stale while this page is alive.
  if (!mePromise) mePromise = api("/auth/me").catch(() => null);
  return mePromise;
}

let mePromise;

// Whether this browser holds a usable session. Asked once per page load and
// memoised for the same reason as getCurrentUser.
//
// /auth/me answers an anonymous visitor with 401, and a 401 reaches the
// browser console as a failed resource even when the calling code catches it.
// /auth/session exists so the common question - "is anyone signed in?" - gets
// a 200 either way. null means unknown (an older backend without the
// endpoint, or a failed request); callers fall back to the /auth/me probe
// rather than guessing.
let sessionState;
export function getSession() {
  if (sessionState === undefined) {
    sessionState = api("/auth/session")
      .then((s) => Boolean(s && s.authenticated))
      .catch(() => null);
  }
  return sessionState;
}

// true only when a signed-in session is known. On a backend that predates
// /auth/session this falls back to the /auth/me probe, so nothing that works
// today stops working during the rollout; once the endpoint is deployed the
// probe disappears with it.
export async function isAuthenticated() {
  const state = await getSession();
  if (state === null) return Boolean(await getCurrentUser());
  return state;
}

export async function requireLogin() {
  // A visitor who is known to be logged out is redirected without probing
  // /auth/me: that probe answers 401, and it would print in the console on
  // every visit to a protected page. state === null (older backend) keeps the
  // old probe-then-redirect behaviour.
  if ((await getSession()) !== false) {
    const user = await getCurrentUser();
    if (user) return user;
  }

  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `login.html?next=${encodeURIComponent(next)}`;
  return null;
}

export async function renderAccountProfile() {
  const content = document.querySelector("#content");
  if (!content) return;

  const user = await requireLogin();
  if (!user) return;

  content.innerHTML = `
    <section class="account-panel" aria-labelledby="account-heading">
      <div class="account-avatar" aria-hidden="true">${esc(user.email.charAt(0).toUpperCase())}</div>
      <div class="account-details">
        <span class="section-tag">Your account</span>
        <h2 id="account-heading">Welcome back</h2>
        <p class="muted">You are signed in and ready to shop.</p>
        <dl class="account-info">
          <div>
            <dt>Email</dt>
            <dd>${esc(user.email)}</dd>
          </div>
          <div>
            <dt>Account ID</dt>
            <dd>${esc(user.id)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd><span class="account-status">Active</span></dd>
          </div>
        </dl>
        <div class="account-actions">
          <a class="btn btn-primary" href="orders.html">View orders</a>
          <button class="btn btn-secondary" type="button" data-logout>Log out</button>
        </div>
        <p class="form-message" data-account-message aria-live="polite"></p>
      </div>
    </section>
  `;

  content.querySelector("[data-logout]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api("/auth/logout", {method: "POST"});
      window.location.href = "login.html";
    } catch (error) {
      const message = content.querySelector("[data-account-message]");
      if (message) message.textContent = error.message;
      button.disabled = false;
    }
  });
}

function showFormMessage(form, message, isError = true) {
  const messageElement = form.querySelector("[data-form-message]");
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.classList.toggle("error", isError);
  messageElement.classList.toggle("success", !isError);
}

export function setupAuthForms() {
  const form = document.querySelector("[data-auth-form]");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    const formData = new FormData(form);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password")
    };
    const isRegister = form.dataset.authForm === "register";
    const endpoint = isRegister ? "/auth/register" : "/auth/login";

    submitButton.disabled = true;
    showFormMessage(form, "Working...", false);
    try {
      const result = await api(endpoint, {method: "POST", body: JSON.stringify(payload)});
      if (isRegister) {
        // Registration no longer signs anyone in. Swap the form for the code
        // step, and remember the address so it does not have to be retyped.
        sessionStorage.setItem("pendingVerifyEmail", String(payload.email));
        // The account exists, but whether the code actually left the building is
        // the server's call, not ours. When it did not, the code step is a dead
        // end until the customer resends, so it says so up front and offers the
        // resend control. The notice has to travel into renderVerifyEmailForm
        // because this form is about to be replaced in the DOM.
        const undelivered = result && result.verification_email_sent === false;
        renderVerifyEmailForm(
          String(payload.email),
          undelivered
            ? result.message || "We could not send your verification code. Send it again below."
            : ""
        );
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next || "index.html";
    } catch (error) {
      showFormMessage(form, error.message, true);
      submitButton.disabled = false;
      // A 403 here is the unverified-account case: the password was right, so
      // offer the resend button rather than leaving them stuck.
      if (!isRegister && error.status === 403) {
        form.querySelector("[data-resend-verify]")?.classList.remove("is-hidden");
      }
    }
  });

  form.querySelector("[data-resend-verify]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const email = new FormData(form).get("email") || sessionStorage.getItem("pendingVerifyEmail") || "";
    if (!email) return;
    button.disabled = true;
    try {
      const result = await api("/auth/resend-verification", {method: "POST", body: JSON.stringify({email})});
      showFormMessage(form, result.message || "If that address still needs verifying, a new code is on its way.", false);
    } catch (error) {
      showFormMessage(form, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

// Shown after registration, and reachable at verify-email.html. `email` is the
// address we know about, if any: it is shown read-only, because the code is what
// proves control of the mailbox. When it is not known (a bookmarked visit on a
// new device) the field is editable so the step is still completable.
export function renderVerifyEmailForm(email, notice) {
  const content = document.querySelector("#content");
  if (!content) return;
  const known = Boolean(email);
  const safe = esc(email || "");

  content.innerHTML = `
    <form class="auth-form" data-verify-form>
      <h2>Check your email</h2>
      <p class="muted">${known
        ? `We sent a 6-digit code to <strong>${safe}</strong>. Enter it below to finish creating your account.`
        : "Enter the email you signed up with and the 6-digit code we sent you."}</p>
      ${known ? "" : `<label for="verify-email">Email</label>
      <input id="verify-email" name="email" type="email" autocomplete="email" required />`}
      <label for="verify-code">Verification code</label>
      <input id="verify-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
             pattern="[0-9]{6}" maxlength="6" placeholder="123456" required />
      <p class="form-message" data-form-message aria-live="polite"></p>
      <button class="btn btn-primary" type="submit">Verify and sign in</button>
      <p class="muted"><button type="button" class="inline-link" data-resend-verify>Send the code again</button></p>
      <p class="muted"><a href="login.html">Back to log in</a></p>
    </form>
  `;
  setupVerifyEmailForm(email);

  // `notice` is set when registration reported that no code was actually sent.
  // The heading above then says the opposite, so the warning goes into the
  // message slot of the *new* form - it has to be written after the swap,
  // because the form that carried the failed submit no longer exists in the DOM.
  if (notice) {
    showFormMessage(document.querySelector("[data-verify-form]"), notice, true);
  }
}

function setupVerifyEmailForm(knownEmail) {
  const form = document.querySelector("[data-verify-form]");
  if (!form) return;
  const submitButton = form.querySelector("button[type='submit']");
  // The address is fixed once the form is on screen, so the resend button and
  // the submit handler can never disagree about which mailbox to act on.
  const address = () => knownEmail || new FormData(form).get("email") || "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = new FormData(form).get("code");
    submitButton.disabled = true;
    showFormMessage(form, "Checking...", false);
    try {
      // verify-email signs the customer in on success, so there is no second step.
      await api("/auth/verify-email", {method: "POST", body: JSON.stringify({email: address(), code})});
      sessionStorage.removeItem("pendingVerifyEmail");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next || "index.html";
    } catch (error) {
      showFormMessage(form, error.message, true);
      submitButton.disabled = false;
    }
  });

  form.querySelector("[data-resend-verify]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const email = address();
    if (!email) { showFormMessage(form, "Enter your email first.", true); return; }
    button.disabled = true;
    try {
      const result = await api("/auth/resend-verification", {method: "POST", body: JSON.stringify({email})});
      showFormMessage(form, result.message || "If that address still needs verifying, a new code is on its way.", false);
    } catch (error) {
      showFormMessage(form, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

export function renderAuthForm() {
  const content = document.querySelector("#content");
  if (!content) return;

  const isRegister = window.location.pathname.endsWith("register.html");
  // The reset flow bounces back here with ?reset=1 so the user gets confirmation.
  const justReset = !isRegister && new URLSearchParams(window.location.search).get("reset") === "1";
  content.innerHTML = `
    <form class="auth-form" data-auth-form="${isRegister ? "register" : "login"}">
      ${justReset ? '<p class="form-message success">Your password was updated. Log in with your new password.</p>' : ""}
      <label for="auth-email">Email</label>
      <input id="auth-email" name="email" type="email" autocomplete="email" value="${justReset ? esc(new URLSearchParams(window.location.search).get("email") || "") : ""}" required />
      <label for="auth-password">Password</label>
      <input id="auth-password" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" required />
      <p class="form-message" data-form-message aria-live="polite"></p>
      <button class="btn btn-primary" type="submit">${isRegister ? "Create account" : "Log in"}</button>
      ${isRegister ? "" : '<p class="muted is-hidden"><button type="button" class="inline-link" data-resend-verify>Send my verification code again</button></p>'}
      <p class="muted">${isRegister ? "Already have an account?" : "New to Apex iPhone?"} <a href="${isRegister ? "login.html" : "register.html"}">${isRegister ? "Log in" : "Create an account"}</a></p>
      <p class="muted"><a href="forgot-password.html">Forgot your password?</a></p>
    </form>
  `;
  setupAuthForms();
}// Authentication UI and session helpers.