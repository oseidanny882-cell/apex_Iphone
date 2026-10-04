import { API_BASE } from "./config.js";

// Admin password reset. Uses the same /auth/reset-* endpoints as the storefront:
// there is only ever one admin account, and the API answers generically, so this
// page never reveals whether the address entered is the admin's.
const step1 = document.querySelector("#admin-forgot-step1");
const step2 = document.querySelector("#admin-forgot-step2");

function showMessage(form, message, isError = true) {
  const el = form.querySelector("[data-msg], [data-msg2]");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.toggle("success", !isError);
}

async function post(path, payload) {
  const r = await fetch(API_BASE + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed");
  return d;
}

function busy(form, state) {
  form.querySelectorAll("input, button").forEach((el) => {
    el.disabled = state;
  });
}

step1?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = step1.querySelector("#reset-email").value.trim();
  if (!email) {
    showMessage(step1, "Enter the admin email address.", true);
    return;
  }

  busy(step1, true);
  showMessage(step1, "Sending...", false);
  try {
    await post("/auth/forgot-password", { email });
    // Advance to the code + new password step regardless of the answer, so the
    // page does not confirm whether that email owns an admin account.
    step2.hidden = false;
    step2.querySelector("#reset-email-2").value = email;
    showMessage(step2, "If that email belongs to the admin account, a reset code is on its way. It expires in 15 minutes.", false);
    step2.querySelector("#reset-code").focus();
    busy(step1, false);
  } catch (err) {
    showMessage(step1, err.message, true);
    busy(step1, false);
  }
});

step2?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = step2.querySelector("#reset-email-2").value.trim();
  const code = step2.querySelector("#reset-code").value.trim();
  const password = step2.querySelector("#reset-password").value;

  if (!email || !/^\d{6}$/.test(code)) {
    showMessage(step2, "Enter the admin email and the 6-digit code.", true);
    return;
  }
  if (password.length < 8) {
    showMessage(step2, "Password must be at least 8 characters.", true);
    return;
  }
  if (password !== step2.querySelector("#reset-password-confirm").value) {
    showMessage(step2, "Those passwords do not match.", true);
    return;
  }

  busy(step2, true);
  showMessage(step2, "Saving...", false);
  try {
    await post("/auth/reset-password", { email, code, new_password: password });
    showMessage(step2, "Password updated. Redirecting to the admin login...", false);
    window.setTimeout(() => {
      window.location.href = "login.html?reset=1";
    }, 1200);
  } catch (err) {
    showMessage(step2, err.message, true);
    busy(step2, false);
  }
});