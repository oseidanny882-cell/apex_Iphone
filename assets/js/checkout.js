// Checkout: delivery details -> pay-on-delivery order.
//
// The cart is the source of truth for what is being bought, so the page shows
// the server's cart (not a local copy) and the API decides the total. A rejected
// order leaves the cart untouched, so the customer only has to fix the field the
// server complained about and submit again.
import { api } from "./api.js";

// Mirrors GHANA_REGIONS in backend/app/schemas/order.py. The server validates
// this again; the list exists so the customer picks a region instead of typing
// "Accra" and getting a 422.
export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Western North",
  "Central",
  "Eastern",
  "Volta",
  "Oti",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo"
];

export function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Product images are admin data used inside src="..." — scheme-restricted and
// escaped, same rule as app.js, so a hostile image_url cannot inject markup.
const SAFE_IMAGE_URL = /^(?:https?:\/\/|\/)[^\s"'<>\\]*$/i;

function imgFor(item) {
  const raw = String(item?.image_url ?? "").trim();
  return SAFE_IMAGE_URL.test(raw) ? escHtml(raw) : "../assets/images/products/placeholder.svg";
}

function money(value) {
  return "GH₵ " + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

function readForm(form) {
  const data = new FormData(form);
  const value = (name) => String(data.get(name) ?? "").trim();
  return {
    customer_name: value("customer_name"),
    phone: value("phone"),
    region: value("region"),
    city: value("city"),
    // Optional fields: omit rather than send "" so the schema stores NULL.
    landmark: value("landmark") || null,
    note: value("note") || null
  };
}

// Mirrors normalise_phone() in backend/app/schemas/order.py, purely so the
// customer is told before the round trip. The server remains the authority.
export function isValidGhanaPhone(raw) {
  let digits = String(raw ?? "").replace(/[^0-9+]/g, "");
  const hasPlus = digits.startsWith("+");
  digits = digits.replace(/^\+/, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  let local;
  if (digits.startsWith("233") && digits.length === 12) local = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) local = digits.slice(1);
  else if (digits.length === 9) local = digits;
  else return false;
  if (!/^\d{9}$/.test(local)) return false;
  if (hasPlus && !digits.startsWith("233")) return false;
  return ["2", "3", "5"].includes(local[0]);
}


function summaryHtml(cart) {
  return `
    <div class="soft-panel" style="padding:22px;display:grid;gap:12px">
      <h2 style="margin:0">Order summary</h2>
      ${cart.items
        .map(
          (i) => `
        <div style="display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center">
          <img src="${imgFor(i)}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:10px" loading="lazy">
          <div><div style="font-weight:700">${escHtml(i.name)}</div><div class="muted" style="font-size:.82rem">${escHtml(i.sku || "")} · ${i.qty} × ${money(i.price)}</div></div>
          <strong>${money(i.line_total)}</strong>
        </div>`
        )
        .join("")}
      <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;justify-content:space-between">
        <strong>Total to pay on delivery</strong><strong>${money(cart.total)}</strong>
      </div>
      <p class="muted" style="font-size:.84rem;margin:0">No payment is taken online. We call you on the number you give us to arrange delivery.</p>
    </div>`;
}

const REGION_OPTIONS = GHANA_REGIONS.map((r) => `<option value="${escHtml(r)}">${escHtml(r)}</option>`).join("");

function formHtml() {
  const input = 'style="min-height:48px;border-radius:13px;border:1px solid var(--border);background:rgba(15,23,42,.7);color:var(--text);padding:0 14px"';
  return `
    <form class="soft-panel" style="padding:24px;display:grid;gap:14px" novalidate data-checkout-form>
      <h2 style="margin:0">Delivery details</h2>
      <label style="display:grid;gap:7px"><strong>Full name</strong>
        <input name="customer_name" type="text" autocomplete="name" maxlength="120" placeholder="Osei Daniel" ${input}>
      </label>
      <label style="display:grid;gap:7px"><strong>Phone number</strong>
        <input name="phone" type="tel" autocomplete="tel" placeholder="053 231 9277" ${input}>
        <small class="muted">Ghanaian numbers only. We call this number to arrange delivery.</small>
      </label>
      <label style="display:grid;gap:7px"><strong>Region</strong>
        <select name="region" ${input}>
          <option value="">Select your region…</option>
          ${REGION_OPTIONS}
        </select>
      </label>
      <label style="display:grid;gap:7px"><strong>Town / city</strong>
        <input name="city" type="text" autocomplete="address-level2" maxlength="80" placeholder="Akropong" ${input}>
      </label>
      <label style="display:grid;gap:7px"><strong>Landmark <span class="muted">(optional)</span></strong>
        <input name="landmark" type="text" maxlength="200" placeholder="Near Okoman Radio Station" ${input}>
      </label>
      <label style="display:grid;gap:7px"><strong>Note for the rider <span class="muted">(optional)</span></strong>
        <textarea name="note" maxlength="500" rows="3" style="border-radius:13px;border:1px solid var(--border);background:rgba(15,23,42,.7);color:var(--text);padding:12px" placeholder="Call before arriving"></textarea>
      </label>
      <p class="form-message" data-msg aria-live="polite"></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" type="submit" data-submit>Place order</button>
        <a class="btn btn-ghost" href="cart.html">Back to cart</a>
      </div>
    </form>`;
}

export async function renderCheckoutPage() {
  const content = document.querySelector("#content");
  if (!content || !window.location.pathname.endsWith("checkout.html")) return;

  content.innerHTML = `<p class="muted">Loading your cart…</p>`;

  let cart;
  try {
    cart = await api("/cart");
  } catch (err) {
    content.innerHTML = `<p class="form-message error">${escHtml(err.message)}</p>`;
    return;
  }

  if (!cart.items?.length) {
    content.innerHTML = `
      <div class="soft-panel" style="padding:28px">
        <h2>Your cart is empty</h2>
        <p class="muted">Add something from the shop before checking out.</p>
        <p><a class="btn btn-primary" href="shop.html">Browse shop</a></p>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;align-items:start">
      ${formHtml()}
      ${summaryHtml(cart)}
    </div>`;

  const form = content.querySelector("[data-checkout-form]");
  const msg = content.querySelector("[data-msg]");
  const submit = content.querySelector("[data-submit]");
  const phoneInput = form.elements.phone;

  phoneInput.addEventListener("blur", () => {
    const value = phoneInput.value.trim();
    fieldError(phoneInput, value && !isValidGhanaPhone(value) ? "Enter a valid Ghanaian number, e.g.053 231 9277" : "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    msg.textContent = "";

    const payload = readForm(form);
    const missing = ["customer_name", "phone", "region", "city"].find((name) => !payload[name]);
    if (missing) {
      fieldError(form.elements[missing], "This field is required");
      msg.textContent = "Please fill in the required fields.";
      return;
    }
    if (!isValidGhanaPhone(payload.phone)) {
      fieldError(phoneInput, "Enter a valid Ghanaian number, e.g.053 231 9277");
      msg.textContent = "Please check your phone number.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Placing order…";
    try {
      const order = await api("/orders", { method: "POST", body: JSON.stringify(payload) });
      window.location.href = `order-details.html?id=${encodeURIComponent(order.id)}&placed=1`;
    } catch (err) {
      msg.textContent = err.message || "Could not place your order.";
      submit.disabled = false;
      submit.textContent = "Place order";
    }
  });
}

// Self-starting: checkout.html loads this module directly and the page has
// exactly one buyer, so there is nothing to coordinate with a caller.
renderCheckoutPage();
