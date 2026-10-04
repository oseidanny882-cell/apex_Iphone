import { requireAdmin, adminApi } from "./admin-guard.js";
import { API_BASE } from "./config.js";
const me = await requireAdmin();
document.querySelector("[data-me]").textContent = "Signed in as " + me.email;
document.querySelector("[data-admin-email]").textContent = me.email;
document.querySelector("[data-avatar]").textContent = me.email.charAt(0).toUpperCase();
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
try {
  const items = await adminApi("/admin/products");
  document.querySelector("[data-stat-total]").textContent = items.length;
  document.querySelector("[data-stat-active]").textContent = items.filter((p) => p.active).length;
  document.querySelector("[data-stat-low]").textContent = items.filter((p) => Number(p.stock) <= 5).length;
  const rows = document.querySelector("[data-rows]");
  const recent = items.slice(0, 5);
  rows.innerHTML = recent.length ? recent.map((p) => `<tr><td><div class="p-name">${esc(p.name)}</div><div class="p-sku">${esc(p.sku)}</div></td><td>GH₵ ${Number(p.price).toFixed(2)}</td><td>${p.stock}</td><td><span class="pill ${p.active ? "pill-on" : "pill-off"}">${p.active ? "Active" : "Inactive"}</span></td></tr>`).join("") : '<tr><td colspan="4">No products yet.</td></tr>';
} catch (e) { document.querySelector("[data-rows]").innerHTML = '<tr><td colspan="4">' + esc(e.message) + "</td></tr>"; }
document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  window.location.href = "login.html";
});
