import { requireAdmin, adminApi } from "./admin-guard.js";
import { API_BASE } from "./config.js";
const rows = document.querySelector("[data-rows]");
const msg = document.querySelector("[data-msg]");
const search = document.querySelector("[data-search]");
const emailEl = document.querySelector("[data-admin-email]");
const avatar = document.querySelector("[data-avatar]");
const me = await requireAdmin();
if (emailEl) emailEl.textContent = me.email;
if (avatar) avatar.textContent = me.email.charAt(0).toUpperCase();
let all = [];
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function thumb(p) {
  let src = "../assets/images/products/placeholder.svg";
  if (p.image_url) {
    if (p.image_url.startsWith("http")) src = p.image_url;
    else if (p.image_url.startsWith("/api/")) src = ".." + p.image_url;
    else src = p.image_url;
  }
  return `<img class="p-thumb" src="${esc(src)}" alt="" loading="lazy" onerror="this.src='../assets/images/products/placeholder.svg'">`;
}
function render(filter = "") {
  const q = filter.trim().toLowerCase();
  const items = q ? all.filter((p) => (p.name + " " + p.sku).toLowerCase().includes(q)) : all;
  if (!items.length) { rows.innerHTML = '<tr><td colspan="5">No products found.</td></tr>'; return; }
  rows.innerHTML = items.map((p) => {
    const low = Number(p.stock) <= 5 ? ' <span class="pill pill-low">Low</span>' : "";
    return `<tr><td><div style="display:flex;gap:12px;align-items:center">${thumb(p)}<div><div class="p-name">${esc(p.name)}</div><div class="p-sku">${esc(p.sku)}</div></div></div></td><td>GH₵ ${Number(p.price).toFixed(2)}</td><td>${p.stock}${low}</td><td><span class="pill ${p.active ? "pill-on" : "pill-off"}">${p.active ? "Active" : "Inactive"}</span></td><td style="text-align:right"><a class="inline-link" href="product-edit.html?id=${p.id}">Edit</a></td></tr>`;
  }).join("");
}
try {
  all = await adminApi("/admin/products");
  render("");
} catch (e) { if (msg) msg.textContent = e.message; }
search?.addEventListener("input", () => render(search.value));
document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  window.location.href = "login.html";
});
