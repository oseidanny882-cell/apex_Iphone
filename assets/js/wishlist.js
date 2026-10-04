// Wishlist page renderer
import { api } from "./api.js";

function escHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

async function renderWishlistPage() {
  const content = document.querySelector("#content");
  if (!content || !window.location.pathname.endsWith("wishlist.html")) return;

  content.innerHTML = '<p class="muted">Loading your wishlist…</p>';
  try {
    const wishlist = await api("/wishlist");
    if (!wishlist.items.length) {
      content.innerHTML = `
        <div class="soft-panel" style="padding:28px">
          <h2>Your wishlist is empty</h2>
          <p class="muted">Save items you love. We'll keep them here.</p>
          <p><a class="btn btn-primary" href="shop.html">Browse shop</a></p>
        </div>`;
      return;
    }
    renderWishlistItems(content, wishlist);
  } catch (err) {
    content.innerHTML = `<p class="form-message error">${escHtml(err.message)}</p>`;
  }
}

function renderWishlistItems(container, wishlist) {
  container.innerHTML = `
    <div class="wishlist-grid">
      ${wishlist.items.map(item => `
        <article class="card wishlist-item" data-product-id="${item.product_id}">
          <div class="product-image">
            <img src="${item.image_url || "/assets/img/no-image.svg"}" alt="${escHtml(item.name)}" loading="lazy" />
          </div>
          <div class="product-body">
            <div class="product-title">${escHtml(item.name)}</div>
            <div class="product-meta">
              <span>${escHtml(item.sku)}</span>
              <span>•</span>
              <span class="price-current">GH₵ ${item.price.toLocaleString()}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-danger btn-sm" type="button" data-remove="${item.product_id}">Remove</button>
          </div>
        </article>`).join("")}
    </div>`;
  container.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const pid = btn.getAttribute("data-remove");
      btn.disabled = true;
      try {
        await api("/wishlist/" + pid, { method: "DELETE" });
        btn.closest(".wishlist-item").remove();
        const remaining = container.querySelectorAll(".wishlist-item").length;
        if (!remaining) {
          container.innerHTML = `
            <div class="soft-panel" style="padding:28px">
              <h2>Your wishlist is empty</h2>
              <p><a class="btn btn-primary" href="shop.html">Browse shop</a></p>
            </div>`;
        }
      } catch (err) {
        btn.disabled = false;
        container.innerHTML = `<p class="form-message error">${escHtml(err.message)}</p>`;
      }
    });
  });
}

export { renderWishlistPage };
window.renderWishlistPage = renderWishlistPage;
