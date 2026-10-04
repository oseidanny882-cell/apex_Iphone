import { api } from "./api.js";
import { renderAccountProfile, renderAuthForm, renderVerifyEmailForm, requireLogin } from "./auth.js";
import { renderForgotPasswordForm, renderResetPasswordForm, renderVerifyCodeForm } from "./password-reset.js";
import { renderWishlistPage } from "./wishlist.js";
import { openProductModal } from "../components/modal.js";
import { initNotificationBell, renderNotificationInbox } from "./notifications.js";

const isHome = window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname.endsWith("/");

let products = [];

async function loadProducts() {
  try {
    products = await api("/products/");
  } catch (error) {
    console.error("Unable to load products from the database:", error);
  }
}

const productImage = "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80";

// Product images are admin-controlled data rendered inside src="..." so the URL is
// scheme-restricted and attribute-escaped: a value like `x" onerror="...` cannot
// break out of the attribute and become stored XSS on the storefront.
const SAFE_IMAGE_URL = /^(?:https?:\/\/|\/)[^\s"'<>\\]*$/i;

function imgFor(p) {
  const raw = String(p?.image_url ?? "").trim();
  if (SAFE_IMAGE_URL.test(raw)) return escHtml(raw);
  return productImage;
}

function escHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

async function refreshCartBadge() {
  try {
    const cart = await api("/cart");
    document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = String(cart.count || 0); });
  } catch { /* logged out -> leave badge */ }
}

function renderHeader() {
  const header = document.querySelector("#site-header");
  if (!header) return;

  const navLinks = [
    { label: "Home", href: "index.html" },
    { label: "Shop", href: "shop.html" },
    { label: "Wishlist", href: "wishlist.html" },
    { label: "Cart", href: "cart.html" },
    { label: "Account", href: "account.html" }
  ];

  const currentPath = window.location.pathname.split("/").at(-1) || "index.html";

  header.innerHTML = `
    <div class="container nav-shell">
      <a class="brand" href="index.html" aria-label="Apex iPhone home page">
        <span class="brand-mark">A</span>
        <span>Apex iPhone</span>
      </a>

      <nav class="nav-links" id="primary-navigation" aria-label="Main navigation">
        ${navLinks
          .map(
            (link) => `
              <a class="nav-link ${currentPath === link.href ? "is-active" : ""}" href="${link.href}">
                ${link.label}
              </a>
            `
          )
          .join("")}
      </nav>

      <div class="nav-actions" aria-label="Quick actions">
        <button class="icon-btn" type="button" aria-label="Search">⌕</button>
        <a class="icon-btn" href="wishlist.html" aria-label="Wishlist">
          ♡
        </a>
        <button class="icon-btn" type="button" aria-label="Notifications" aria-expanded="false"
          aria-controls="notification-panel" data-notification-bell>
          🔔<span data-notification-count hidden style="font-size:.7rem;font-weight:800"></span>
        </button>
        <a class="icon-btn" href="cart.html" aria-label="Cart">
          🛒<span data-cart-count style="font-size:.7rem;font-weight:800"></span>
        </a>
      </div>

      <button class="btn btn-ghost mobile-toggle" type="button" aria-label="Toggle menu" aria-controls="primary-navigation" aria-expanded="false" data-mobile-toggle>
        ☰
      </button>
    </div>
  `;

  const toggle = header.querySelector("[data-mobile-toggle]");
  const nav = header.querySelector(".nav-links");
  const setMobileNavOpen = (open) => {
    if (!nav) return;
    nav.classList.toggle("is-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
  };

  toggle?.addEventListener("click", () => {
    setMobileNavOpen(!nav?.classList.contains("is-open"));
  });

  nav?.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => setMobileNavOpen(false));
  });

  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) setMobileNavOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMobileNavOpen(false);
  });
}

function renderFooter() {
  const footer = document.querySelector("#site-footer");
  if (!footer) return;

  // The markup is <footer id="site-footer"> with no class, so every .site-footer
  // rule in global.css and components.css (background, padding, border-top) was
  // matching nothing. Add the class here, the one place the footer is built, so
  // all pages pick it up without editing 20-odd HTML files.
  footer.classList.add("site-footer");

  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html" aria-label="Apex iPhone home page" style="color: white; margin-bottom: 16px; display:inline-flex;">
            <span class="brand-mark">A</span>
            <span>Apex iPhone</span>
          </a>
          <p class="muted" style="color: rgba(255,255,255,0.72); max-width: 320px;">
            Premium iPhones and accessories for modern Ghanaian lifestyles, delivered with reliability and care.
          </p>
        </div>

        <div>
          <div class="footer-title">Shop</div>
          <ul class="footer-list">
            <li><a href="shop.html">New arrivals</a></li>
            <li><a href="shop.html">iPhone 15</a></li>
            <li><a href="shop.html">Accessories</a></li>
            <li><a href="cart.html">Cart</a></li>
          </ul>
        </div>

        <div>
          <div class="footer-title">Company</div>
          <ul class="footer-list">
            <li><a href="about.html">About</a></li>
            <li><a href="contact.html">Contact</a></li>
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="privacy.html">Privacy</a></li>
          </ul>
        </div>

        <div>
          <div class="footer-title">Support</div>
          <ul class="footer-list">
            <li><a href="shipping.html">Shipping</a></li>
            <li><a href="orders.html">Orders</a></li>
            <li><a href="account.html">Account</a></li>
            <li><a href="terms.html">Terms</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© 2026 Apex iPhone. All rights reserved.</span>
        <span>Prices in GH₵ • Order online, pay on delivery</span>
      </div>
    </div>
  `;
}

// One card for every product on the page.
//
// This was two near-identical templates - renderFeaturedProducts and
// renderShopCatalog - which had already drifted (the badge class differed), so a
// fix applied to one would silently miss the other. They now share this, and the
// only difference between a homepage card and a shop card is the badge colour.
//
// The card deliberately shows nothing but what someone needs to decide at a
// glance: image, availability, title, price, and the two actions. The SKU, the
// stock count and the long `details` text live in the modal - see
// components/modal.js, which the title and image open.
//
// Clicking the whole card is NOT how the modal opens, and that is deliberate. A
// card-sized hit area next to an "Add to cart" button means stray taps on a
// phone add things to a real basket. The image and the title are the targets;
// the wishlist and cart buttons keep their own handlers.
function productCard(product, index, options = {}) {
  const badgeClass = options.badgeClass || "badge-success";
  const inStock = Number(product.stock) > 0;
  const name = escHtml(product.name);

  return `
    <article class="product-card card" data-animate data-product-id="${product.id}" style="transition-delay: ${index * 70}ms;">
      <button class="product-image product-image--clickable" type="button" data-view-product="${product.id}" aria-label="View details for ${name}">
        <img src="${imgFor(product)}" alt="${name}" loading="lazy" onerror="this.src='assets/img/placeholder.svg'" />
        <span class="badge ${badgeClass} product-card__badge">${inStock ? "In stock" : "Sold out"}</span>
      </button>
      <div class="product-body">
        <div class="product-top">
          <button class="product-title product-title--link" type="button" data-view-product="${product.id}">${name}</button>
          <button class="wishlist-btn" type="button" aria-label="Add ${name} to wishlist">♡</button>
        </div>
        <div class="product-price">
          <span class="price-current">GH₵ ${product.price.toLocaleString()}</span>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary" type="button" data-add-cart="${product.id}" ${inStock ? "" : "disabled"}>Add to cart</button>
          <button class="btn btn-ghost" type="button" data-view-product="${product.id}">View details</button>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedProducts() {
  const target = document.querySelector("#featured-products");
  if (!target) return;

  target.innerHTML = products
    .slice(0, 4)
    .map((product, index) => productCard(product, index, { badgeClass: "badge-new" }))
    .join("");
}

function renderShopCatalog() {
  const target = document.querySelector("#shop-catalog");
  if (!target) return;
  target.innerHTML = filterProducts(products, currentQuery()).map((product, index) => productCard(product, index)).join("");
  setupRevealAnimations();
  setupProductPicker();
  setupProductDetailsToggle();
  setupWishlistToggle();
}

function currentQuery() {
  return (new URLSearchParams(window.location.search).get("q") || "").trim();
}

// Matches on name, SKU and the description, because the placeholder promises all
// three ("model, storage, or SKU") and storage lives inside the name
// ("iPhone 15 128GB"). Every field is compared against the same lowercased
// needle so "IP15-128" finds the product by SKU.
function filterProducts(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const terms = q.split(/\s+/).filter(Boolean);
  return list.filter((product) => {
    const haystack = [product.name, product.sku, product.details]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    // Every term must appear somewhere, so "iphone 15 128" narrows rather than
    // widening - a single substring match would ignore the extra words.
    return terms.every((term) => haystack.includes(term));
  });
}

// The search box had no event handler at all, and no form around it either, so
// pressing Enter did nothing and the ?q= filter the renderer already supported
// could only be reached by hand-editing the URL.
//
// Three behaviours, in the order a shopper expects them:
//   1. Typing filters the grid as you go, with a short debounce so a fast typist
//      does not re-render 200 cards per keystroke.
//   2. Enter commits the search into the URL. That makes a search shareable and
//      survives a refresh, and it is why the renderer reads ?q= in the first place.
//   3. Escape clears it.
// The input is also hydrated from ?q= on load, so a shared link shows the term
// that produced the results.
function setupSearch() {
  const bar = document.querySelector(".searchbar");
  if (!bar) return;
  const input = bar.querySelector("input");
  if (!input) return;

  // The box may pre-exist a search, e.g. when arriving on a shared link.
  const initial = currentQuery();
  if (initial) input.value = initial;

  let timer = null;

  const apply = (query, { push } = { push: false }) => {
    const target = document.querySelector("#shop-catalog");
    if (!target) return;

    const trimmed = query.trim();
    if (trimmed) {
      if (push) {
        // replaceState rather than location.search: reloading would throw away
        // the scroll position and re-fetch the catalogue on every Enter.
        const url = new URL(window.location.href);
        url.searchParams.set("q", trimmed);
        window.history.replaceState({}, "", url);
      }
    } else if (push) {
      const url = new URL(window.location.href);
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url);
    }

    const matches = filterProducts(products, trimmed);
    if (!matches.length) {
      target.innerHTML = `
        <div class="soft-panel" style="padding:28px">
          <h2>No products found</h2>
          <p class="muted">Nothing matches &ldquo;${escHtml(trimmed)}&rdquo;. Try a model like &ldquo;iPhone 15&rdquo; or a SKU.</p>
        </div>`;
      return;
    }
    target.innerHTML = matches.map((p, i) => productCard(p, i)).join("");
    // The handlers are delegated from document, but the reveal animation is not,
    // so freshly rendered cards have to be re-registered.
    setupRevealAnimations();
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => apply(input.value), 180);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(timer);
      apply(input.value, { push: true });
    } else if (event.key === "Escape") {
      // Stop the native "clear" behaviour too, or the input empties without the
      // grid following it.
      event.preventDefault();
      clearTimeout(timer);
      input.value = "";
      apply("", { push: true });
    }
  });
}

function setupRevealAnimations() {
  const animatedItems = document.querySelectorAll("[data-animate]");
  if (!animatedItems.length) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    animatedItems.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  animatedItems.forEach((element) => observer.observe(element));
}

function setupProductPicker() {
  const customPhone = document.querySelector("#custom-phone");
  const phoneSurface = document.querySelector("#phone-color-surface");
  const swatches = document.querySelectorAll(".color-swatch");

  if (!customPhone || !swatches.length) return;

  const palettes = {
    default: {
      phone: "linear-gradient(180deg, rgba(12, 18, 32, 0.95), rgba(58, 65, 84, 0.9))",
      glow: "radial-gradient(circle at top, rgba(94,231,255,0.18), transparent 35%)",
      accent: "rgba(94, 231, 255, 0.6)"
    },
    midnight: {
      phone: "linear-gradient(180deg, rgba(8, 10, 18, 0.95), rgba(30, 35, 48, 0.92))",
      glow: "radial-gradient(circle at top, rgba(139, 92, 246, 0.2), transparent 35%)",
      accent: "rgba(139, 92, 246, 0.6)"
    },
    aurora: {
      phone: "linear-gradient(180deg, rgba(10, 30, 28, 0.95), rgba(25, 68, 58, 0.9))",
      glow: "radial-gradient(circle at top, rgba(74, 222, 128, 0.2), transparent 35%)",
      accent: "rgba(74, 222, 128, 0.6)"
    }
  };

  const setColor = (key) => {
    const palette = palettes[key] || palettes.default;
    const phoneFace = customPhone.querySelector(".hero-phone");
    if (phoneFace) {
      phoneFace.style.background = palette.phone;
      phoneFace.style.boxShadow = "inset 0 0 22px rgba(255,255,255,0.12), 0 12px 26px rgba(5, 10, 20, 0.7)";
    }

    if (phoneSurface) {
      phoneSurface.style.background = palette.glow;
    }

    const ripple = document.createElement("span");
    ripple.className = "color-ripple";
    ripple.style.background = palette.accent;
    customPhone.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  };

  swatches.forEach((swatch) => {
    swatch.addEventListener("click", () => {
      swatches.forEach((item) => item.classList.toggle("active", item === swatch));
      setColor(swatch.dataset.color || "default");
    });
  });
}

function setupCartAnimation() {
  document.addEventListener("click", async (event) => {
    const cartButton = event.target.closest("[data-add-cart], #add-cart-btn, .product-actions .btn-primary");
    if (!cartButton || cartButton.disabled) return;
    const user = await requireLogin();
    if (!user) return;
    const productId = cartButton.getAttribute("data-add-cart") || cartButton.getAttribute("data-product-id");
    if (!productId) {
      cartButton.textContent = "View product to add";
      setTimeout(() => { cartButton.textContent = "Add to Cart"; }, 1200);
      return;
    }
    const beforeText = cartButton.textContent;
    cartButton.disabled = true;
    cartButton.textContent = "Adding…";
    try {
      const cart = await api("/cart/items", { method: "POST", body: JSON.stringify({ product_id: productId, qty: 1 }) });
      cartButton.textContent = "✓ Added";
      document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = String(cart.count || 0); });
    } catch (err) {
      cartButton.textContent = err.message || "Could not add";
    }
    setTimeout(() => {
      cartButton.textContent = beforeText;
      cartButton.disabled = false;
    }, 1200);
  });
}

// The FAQ accordion. Kept separate from the product modal above because it is
// a different behaviour entirely: an inline expander that toggles one open panel
// at a time, rather than an overlay.
//
// faq.html writes its questions as [data-toggle] headings and its answers as
// [data-details] panels, and reuses the product card's old class names for
// styling. The panels are divs, not buttons, so keyboard activation is wired up
// explicitly here - the product modal gets Enter and Space free from using real
// <button> elements, but a div[role=button] does not.
function setupFaqAccordion() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle]");
    // Only the FAQ uses these now, but the guard keeps a product card from
    // reaching this branch if the attribute is ever reused.
    if (!toggle || !toggle.closest(".faq-item")) return;

    const id = toggle.getAttribute("data-toggle");
    const panel = document.querySelector(`[data-details="${CSS.escape(id)}"]`);
    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    // Close whichever one is open, so only a single answer is ever visible.
    document.querySelectorAll("[data-details].is-open").forEach((open) => {
      open.classList.remove("is-open");
      const other = document.querySelector(
        "[data-toggle=" + CSS.escape(open.getAttribute("data-details")) + "]"
      );
      if (other) other.setAttribute("aria-expanded", "false");
    });

    if (!isOpen) {
      if (panel) panel.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const toggle = event.target.closest("[data-toggle]");
    if (!toggle || !toggle.closest(".faq-item")) return;
    event.preventDefault();
    toggle.click();
  });
}

// Opens the product detail modal. Replaces the old inline "Details" expander,
// which rendered the full description inside the card and made the grid
// unreadable. The same text now goes to the modal.
//
// One delegated listener on the document rather than a listener per card, so a
// grid of 200 products attaches one handler instead of 200. The triggers are
// real <button type="button"> elements, so this only handles click - Enter and
// Space come free from the browser.
function setupProductDetailsToggle() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-view-product]");
    if (!trigger) return;
    // A click inside the modal's own "Add to cart" must not fall through and
    // reopen the dialog behind the cart drawer.
    if (event.target.closest("[data-modal-add]")) return;

    const id = trigger.getAttribute("data-view-product");
    const product = products.find((p) => String(p.id) === String(id));
    if (!product) return;
    openProductModal(product, { imageUrl: imgFor(product) });
  });
}



function setupWishlistToggle() {
  document.addEventListener("click", async (event) => {
    const btn = event.target.closest(".wishlist-btn");
    if (!btn) return;
    const productId = btn.closest(".product-card")?.getAttribute("data-product-id");
    if (!productId) return;
    btn.disabled = true;
    try {
      const wishlist = await api("/wishlist");
      const alreadyIn = wishlist.items.some(i => i.product_id === productId);
      if (alreadyIn) {
        await api("/wishlist/" + productId, { method: "DELETE" });
        btn.innerHTML = "♤";
        btn.setAttribute("aria-label", "Add to wishlist");
      } else {
        await api("/wishlist", { method: "POST", body: JSON.stringify({ product_id: productId }) });
        btn.innerHTML = "♥";
        btn.setAttribute("aria-label", "Remove from wishlist");
      }
    } catch (err) {
      btn.disabled = false;
    }
  });
}

async function refreshWishlistState() {
  try {
    const wishlist = await api("/wishlist");
    const ids = new Set(wishlist.items.map(i => i.product_id));
    document.querySelectorAll(".wishlist-btn").forEach(btn => {
      const card = btn.closest(".product-card");
      if (card && ids.has(card.getAttribute("data-product-id"))) {
        btn.innerHTML = "♥";
        btn.setAttribute("aria-label", "Remove from wishlist");
      }
    });
  } catch { /* not logged in */ }
}
async function renderCartPage() {
  const content = document.querySelector("#content");
  if (!content || !window.location.pathname.endsWith("cart.html")) return;
  content.innerHTML = `<p class="muted">Loading your cart…</p>`;
  try {
    const cart = await api("/cart");
    if (!cart.items.length) {
      content.innerHTML = `<div class="soft-panel" style="padding:28px"><h2>Your cart is empty</h2><p class="muted">Add something from the shop and it will show up here.</p><p><a class="btn btn-primary" href="shop.html">Browse shop</a></p></div>`;
      return;
    }
    content.innerHTML = `
      <div class="cart-panel">
        ${cart.items.map((i) => `
          <div class="cart-line">
            <img class="cart-thumb" src="${imgFor(i)}" alt="${escHtml(i.name)}" loading="lazy">
            <div class="cart-body">
              <div class="cart-name">${escHtml(i.name)}</div>
              <div class="cart-meta">${escHtml(i.sku)} · GH₵ ${Number(i.price).toLocaleString()}</div>
            </div>
            <strong class="cart-total">GH₵ ${Number(i.line_total).toLocaleString()}</strong>
            <div class="cart-qty">
              <button class="btn btn-ghost" type="button" data-dec="${i.product_id}" aria-label="Decrease quantity">−</button>
              <strong>${i.qty}</strong>
              <button class="btn btn-ghost" type="button" data-inc="${i.product_id}" aria-label="Increase quantity">+</button>
              <button class="inline-link" type="button" data-remove="${i.product_id}" id="hovering">Remove</button>
            </div>
          </div>`).join("")}
        <div class="cart-foot">
          <strong>Total: GH₵ ${Number(cart.total).toLocaleString()}</strong>
          <div class="cart-foot-actions"><button class="btn btn-ghost" type="button" data-clear>Clear</button><a class="btn btn-primary" href="checkout.html">Checkout</a></div>
        </div>
      </div>`;
    content.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", async () => {
      const row = cart.items.find((x) => x.product_id === b.getAttribute("data-inc"));
      await api(`/cart/items/${b.getAttribute("data-inc")}`, { method: "PATCH", body: JSON.stringify({ qty: Math.min(99, row.qty + 1) }) });
      renderCartPage(); refreshCartBadge();
    }));
    content.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", async () => {
      const row = cart.items.find((x) => x.product_id === b.getAttribute("data-dec"));
      if (row.qty <= 1) { await api(`/cart/items/${b.getAttribute("data-dec")}`, { method: "DELETE" }); }
      else { await api(`/cart/items/${b.getAttribute("data-dec")}`, { method: "PATCH", body: JSON.stringify({ qty: row.qty - 1 }) }); }
      renderCartPage(); refreshCartBadge();
    }));
    content.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/cart/items/${b.getAttribute("data-remove")}`, { method: "DELETE" });
      renderCartPage(); refreshCartBadge();
    }));
    content.querySelector("[data-clear]")?.addEventListener("click", async () => {
      await api("/cart", { method: "DELETE" });
      renderCartPage(); refreshCartBadge();
    });
  } catch (err) {
    content.innerHTML = `<p class="form-message error">${escHtml(err.message)}</p>`;
  }
}

async function setupProtectedPages() {
  const protectedPage = ["account.html", "cart.html", "checkout.html", "orders.html", "order-details.html"].some((page) => window.location.pathname.endsWith(page));
  if (protectedPage) await requireLogin();
}

function setupFeatureTilt() {
  const cards = document.querySelectorAll(".feature-card");
  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rotateY = ((x / rect.width) - 0.5) * 10;
      const rotateX = (0.5 - (y / rect.height)) * 10;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

renderHeader();
renderFooter();

if (window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("register.html")) {
  renderAuthForm();
}

if (window.location.pathname.endsWith("forgot-password.html")) {
  renderForgotPasswordForm();
}

if (window.location.pathname.endsWith("verify.html")) {
  renderVerifyCodeForm();
}

if (window.location.pathname.endsWith("verify-email.html")) {
  // Reachable after a closed tab or a new device: the address is remembered in
  // this tab, and the form falls back to asking for it when it is not.
  renderVerifyEmailForm(sessionStorage.getItem("pendingVerifyEmail") || "");
}

if (window.location.pathname.endsWith("reset-password.html")) {
  renderResetPasswordForm();
}

async function initializeStorefront() {
  await loadProducts();
  if (isHome) renderFeaturedProducts();
  if (window.location.pathname.endsWith("shop.html")) {
    renderShopCatalog();
    // After the grid is rendered, so the first paint is not overwritten.
    setupSearch();
  }
  setupRevealAnimations();
  setupProductPicker();
  setupCartAnimation();
  setupProductDetailsToggle();
  // The FAQ accordion is page-local: its panels are static markup in faq.html, so
  // the handler is attached only there rather than on every page.
  if (window.location.pathname.endsWith("faq.html")) setupFaqAccordion();
  setupWishlistToggle();
  setupFeatureTilt();
  await setupProtectedPages();
  await refreshCartBadge();
  await initNotificationBell();
  await refreshWishlistState();
  await renderCartPage();
  if (window.location.pathname.endsWith("account.html")) {
    await renderAccountProfile();
    await renderNotificationInbox();
  }
  if (window.location.pathname.endsWith("wishlist.html")) await renderWishlistPage();
}

initializeStorefront();

try {
  api("/health");
} catch (error) {
  console.info("API health check skipped in static preview mode.");
}
