// Admin orders: the pay-on-delivery queue and a single order's detail.
//
// Pending orders are what the admin actually acts on, so the list puts them
// first and the status filter exists to get them out of the way afterwards.
import { requireAdmin, adminApi } from "./admin-guard.js";
import { API_BASE } from "./config.js";

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

const PILL_CLASS = {
  pending: "pill-low",
  confirmed: "pill-on",
  delivered: "pill-on",
  cancelled: "pill-off"
};

// Mirrors the lifecycle in admin_update_order(): pending -> confirmed ->
// delivered, or cancelled from either of the first two.
const NEXT_STATUSES = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
};

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function money(value) {
  return "GH₵ " + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function statusPill(status) {
  const key = String(status || "").toLowerCase();
  return `<span class="pill ${PILL_CLASS[key] || "pill-off"}">${esc(STATUS_LABELS[key] || key)}</span>`;
}

export function shortId(id) {
  return esc(String(id || "").slice(0, 8));
}

async function logout() {
  await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  window.location.href = "login.html";
}

function wireChrome(me) {
  const emailEl = document.querySelector("[data-admin-email]");
  const avatar = document.querySelector("[data-avatar]");
  const meEl = document.querySelector("[data-me]");
  if (emailEl) emailEl.textContent = me.email;
  if (avatar) avatar.textContent = me.email.charAt(0).toUpperCase();
  if (meEl) meEl.textContent = "Signed in as " + me.email;
  document.querySelector("[data-logout]")?.addEventListener("click", logout);
}

const rows = document.querySelector("[data-rows]");
const msg = document.querySelector("[data-msg]");
const filterBar = document.querySelector("[data-filter]");

let all = [];
let activeFilter = "";

function renderRows() {
  if (!rows) return;
  const items = activeFilter ? all.filter((o) => o.status === activeFilter) : all;
  if (!items.length) {
    rows.innerHTML = `<tr><td colspan="7">${activeFilter ? `No ${esc(activeFilter)} orders.` : "No orders yet."}</td></tr>`;
    return;
  }
  rows.innerHTML = items
    .map(
      (o) => `
      <tr data-order="${esc(o.id)}">
        <td><a class="inline-link" href="order-details.html?id=${encodeURIComponent(o.id)}">${shortId(o.id)}</a></td>
        <td><div class="p-name">${esc(o.customer_name || "—")}</div><div class="p-sku">${esc(o.customer_email || "")}</div></td>
        <td><div>${esc(o.phone || "—")}</div><div class="p-sku">${esc([o.city, o.region].filter(Boolean).join(", "))}</div></td>
        <td>${o.item_count || 0}</td>
        <td>${money(o.total)}</td>
        <td>${statusPill(o.status)}<div class="p-sku">${esc(dateLabel(o.created_at))}</div></td>
        <td style="text-align:right;white-space:nowrap" data-actions></td>
      </tr>`
    )
    .join("");

  items.forEach((o) => {
    const cell = rows.querySelector(`tr[data-order="${CSS.escape(o.id)}"] [data-actions]`);
    if (cell) cell.append(...actionButtons(o));
  });
}

function actionButtons(order) {
  const buttons = (NEXT_STATUSES[order.status] || []).map((target) => {
    const danger = target === "cancelled";
    const label = target === "confirmed" ? "Confirm" : target === "delivered" ? "Delivered" : "Cancel";
    const b = document.createElement("button");
    b.type = "button";
    b.className = danger ? "btn btn-secondary" : "btn btn-primary";
    b.style.marginLeft = "6px";
    b.textContent = label;
    b.addEventListener("click", () => setStatus(order, target, b));
    return b;
  });
  if (!buttons.length) {
    const span = document.createElement("span");
    span.className = "p-sku";
    span.textContent = "No further action";
    buttons.push(span);
  }
  return buttons;
}

async function setStatus(order, target, button) {
  if (target === "cancelled" && !window.confirm(`Cancel order ${String(order.id).slice(0, 8)}? This cannot be undone.`)) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Saving…";
  if (msg) msg.textContent = "";
  try {
    const updated = await adminApi(`/admin/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: target })
    });
    all = all.map((o) => (o.id === updated.id ? updated : o));
    renderRows();
  } catch (err) {
    // Confirming can fail on stock (409); the message says what to do about it.
    if (msg) msg.textContent = err.message;
    button.disabled = false;
    button.textContent = original;
  }
}

async function load() {
  if (!rows) return;
  try {
    all = await adminApi("/admin/orders");
    renderRows();
  } catch (err) {
    rows.innerHTML = `<tr><td colspan="7">${esc(err.message)}</td></tr>`;
  }
}

function wireFilter() {
  if (!filterBar) return;
  const buttons = filterBar.querySelectorAll("[data-f]");
  buttons.forEach((b) => {
    b.addEventListener("click", () => {
      activeFilter = b.dataset.f;
      buttons.forEach((x) => x.classList.toggle("is-active", x === b));
      renderRows();
    });
  });
}

// ---------------------------------------------------------------------------
// Order detail page (admin/order-details.html) — same script, different DOM.
// ---------------------------------------------------------------------------

function lineRow(item) {
  return `
      <tr>
        <td><div class="p-name">${esc(item.name)}</div><div class="p-sku">${esc(item.sku || "—")}</div></td>
        <td>${money(item.unit_price)}</td>
        <td>${item.qty}</td>
        <td style="text-align:right">${money(item.line_total)}</td>
      </tr>`;
}

function detailRows(order) {
  const items = order.items || [];
  const place = [order.city, order.region].filter(Boolean).join(", ");
  const count = order.item_count ?? items.reduce((n, i) => n + Number(i.qty || 0), 0);
  return `
    <div class="admin-stats">
      <div class="admin-card"><div class="stat-label">Total (pay on delivery)</div><div class="stat-num">${money(order.total)}</div></div>
      <div class="admin-card"><div class="stat-label">Items</div><div class="stat-num">${count}</div></div>
      <div class="admin-card"><div class="stat-label">Status</div><div style="margin-top:10px">${statusPill(order.status)}<div class="p-sku" style="margin-top:8px">Updated ${esc(dateLabel(order.updated_at))}</div></div></div>
    </div>
    <div class="admin-card" style="margin-bottom:16px">
      <h3 style="margin:0 0 8px">Customer &amp; delivery</h3>
      <div style="display:grid;gap:6px">
        <div><strong>${esc(order.customer_name || "—")}</strong> · ${esc(order.phone || "—")}</div>
        <div class="p-sku">${esc(order.customer_email || "No account attached to this order")}</div>
        <div class="p-sku">${esc(place || "—")}${order.landmark ? " · " + esc(order.landmark) : ""}</div>
        ${order.note ? `<div class="p-sku">Note: ${esc(order.note)}</div>` : ""}
      </div>
    </div>
    <div class="admin-card">
      <h3 style="margin:0 0 10px">Items</h3>
      <div class="table-wrap" style="margin-top:0"><table class="admin-table">
        <thead><tr><th>Product</th><th>Unit price</th><th>Qty</th><th style="text-align:right">Line total</th></tr></thead>
        <tbody>${items.length ? items.map(lineRow).join("") : `<tr><td colspan="4">No items recorded for this order.</td></tr>`}</tbody>
      </table></div>
    </div>`;
}

function showDetail(order) {
  const detail = document.querySelector("[data-detail]");
  if (!detail) return;
  detail.innerHTML = detailRows(order);
  const title = document.querySelector("[data-title]");
  if (title) title.textContent = `Order ${shortId(order.id)}`;
  const actions = actionButtons(order);
  if (actions.length) {
    const bar = document.createElement("div");
    bar.className = "admin-actions";
    bar.style.margin = "0 0 18px";
    bar.append(...actions);
    detail.prepend(bar);
  }
}

async function loadDetail() {
  const detail = document.querySelector("[data-detail]");
  if (!detail) return;
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    detail.innerHTML = `<p class="form-message error">No order was specified. <a class="inline-link" href="orders.html">Back to orders</a>.</p>`;
    return;
  }
  try {
    showDetail(await adminApi(`/admin/orders/${encodeURIComponent(id)}`));
  } catch (err) {
    detail.innerHTML = `<p class="form-message error">${esc(err.message)} <a class="inline-link" href="orders.html">Back to orders</a>.</p>`;
  }
}

(async () => {
  let me;
  try {
    me = await requireAdmin();
  } catch {
    return; // requireAdmin() already logged out and redirected to the admin login
  }
  wireChrome(me);
  wireFilter();
  await load();
  await loadDetail();
})();
