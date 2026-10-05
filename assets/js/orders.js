// Orders: the customer's own order history and one order's detail.
//
// Same markup language as the cart page in app.js — soft-panel cards rather than
// a table, because most customers read this on a phone.
import { api } from "./api.js";
import { isAuthenticated } from "./auth.js";

const STATUS_LABELS = {
  pending: "Pending — awaiting our call",
  confirmed: "Confirmed — delivery arranged",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

const STATUS_COLORS = {
  pending: "var(--warning, #fbbf24)",
  confirmed: "var(--accent, #5ee7ff)",
  delivered: "var(--success, #34d399)",
  cancelled: "var(--danger, #fb7185)"
};

export function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function money(value) {
  return "GH₵ " + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusPill(status) {
  const key = String(status || "").toLowerCase();
  const label = STATUS_LABELS[key] || key;
  return `<span class="pill" style="color:${STATUS_COLORS[key] || "var(--muted)"};border:1px solid currentColor">${escHtml(label)}</span>`;
}

function dateLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function shortId(id) {
  return escHtml(String(id || "").slice(0, 8));
}

function itemsHtml(order) {
  if (!order.items?.length) return `<p class="muted">No line items recorded for this order.</p>`;
  return order.items
    .map(
      (i) => `
      <div style="display:grid;grid-template-columns:1fr auto;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:700">${escHtml(i.name)}</div>
          <div class="muted" style="font-size:.82rem">${escHtml(i.sku || "")} · ${i.qty} × ${money(i.unit_price)}</div>
        </div>
        <strong>${money(i.line_total)}</strong>
      </div>`
    )
    .join("");
}


export async function renderOrdersPage() {
  const content = document.querySelector("#content");
  if (!content || !window.location.pathname.endsWith("orders.html")) return;
  // Self-started while requireLogin()'s redirect for a visitor is still in
  // flight: /orders would answer 401 on the way out of the page.
  if (!(await isAuthenticated())) return;

  content.innerHTML = `<p class="muted">Loading your orders…</p>`;
  try {
    const orders = await api("/orders");
    if (!orders.length) {
      content.innerHTML = `
        <div class="soft-panel" style="padding:28px">
          <h2>No orders yet</h2>
          <p class="muted">Orders you place will appear here with their delivery status.</p>
          <p><a class="btn btn-primary" href="shop.html">Browse shop</a></p>
        </div>`;
      return;
    }
    content.innerHTML = `
      <div style="display:grid;gap:14px">
        ${orders
          .map(
            (o) => `
          <a class="soft-panel" href="order-details.html?id=${encodeURIComponent(o.id)}" style="padding:20px;display:grid;gap:10px;text-decoration:none;color:inherit">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
              <div><strong>Order ${shortId(o.id)}</strong><div class="muted" style="font-size:.84rem">${escHtml(dateLabel(o.created_at))}</div></div>
              ${statusPill(o.status)}
            </div>
            <div class="muted" style="font-size:.88rem">${o.items?.length || 0} line item(s) · ${escHtml([o.city, o.region].filter(Boolean).join(", "))}</div>
            <div style="display:flex;justify-content:space-between"><span class="muted">Total (pay on delivery)</span><strong>${money(o.total)}</strong></div>
          </a>`
          )
          .join("")}
      </div>`;
  } catch (err) {
    content.innerHTML = `<p class="form-message error">${escHtml(err.message)}</p>`;
  }
}

export async function renderOrderDetailsPage() {
  const content = document.querySelector("#content");
  if (!content || !window.location.pathname.endsWith("order-details.html")) return;
  // Same redirect race as renderOrdersPage above.
  if (!(await isAuthenticated())) return;

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    content.innerHTML = `<p class="form-message error">No order was specified. <a class="inline-link" href="orders.html">See your orders</a>.</p>`;
    return;
  }

  content.innerHTML = `<p class="muted">Loading your order…</p>`;
  try {
    const o = await api(`/orders/${encodeURIComponent(id)}`);
    const justPlaced = new URLSearchParams(window.location.search).get("placed") === "1";
    content.innerHTML = `
      ${justPlaced ? `<div class="soft-panel" style="padding:18px;margin-bottom:14px"><strong>Thank you — your order is in.</strong><p class="muted" style="margin:6px 0 0">We will call ${escHtml(o.phone || "you")} to arrange delivery. Payment is on delivery.</p></div>` : ""}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;align-items:start">
        <div class="soft-panel" style="padding:22px;display:grid;gap:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <h2 style="margin:0">Order ${shortId(o.id)}</h2>
            ${statusPill(o.status)}
          </div>
          <p class="muted" style="margin:0">Placed ${escHtml(dateLabel(o.created_at))}</p>
          ${itemsHtml(o)}
          <div style="display:flex;justify-content:space-between"><strong>Total to pay on delivery</strong><strong>${money(o.total)}</strong></div>
        </div>
        <div class="soft-panel" style="padding:22px;display:grid;gap:8px">
          <h2 style="margin:0 0 4px">Delivery details</h2>
          <div><strong>${escHtml(o.customer_name || "")}</strong></div>
          <div class="muted">${escHtml(o.phone || "")}</div>
          <div class="muted">${escHtml([o.city, o.region].filter(Boolean).join(", "))}</div>
          ${o.landmark ? `<div class="muted">Landmark: ${escHtml(o.landmark)}</div>` : ""}
          ${o.note ? `<div class="muted">Note: ${escHtml(o.note)}</div>` : ""}
          <p><a class="btn btn-ghost" href="orders.html">All orders</a></p>
        </div>
      </div>`;
  } catch (err) {
    content.innerHTML = `<p class="form-message error">${escHtml(err.message)} <a class="inline-link" href="orders.html">See your orders</a>.</p>`;
  }
}

// Self-starting: each page renders whichever view its filename matches.
(async () => {
  await renderOrdersPage();
  await renderOrderDetailsPage();
})();
