// Product detail modal.
//
// Built on the native <dialog> element rather than a div with a class. That
// choice is what keeps this file short: showModal() gives a focus trap, Escape
// to close, inert background content and ::backdrop for free, all of which are
// the parts a hand-rolled overlay usually gets wrong.
//
// The dialog is created once and reused. Opening it does not rebuild the
// element, so the focus trap survives opening a second product.
//
// The "Add to cart" button inside the modal carries the same data-add-cart
// attribute as the one on the card, so app.js's existing delegated click handler
// picks it up unchanged. The modal deliberately knows nothing about carts.

let dialog = null;

function specRow(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = String(value);
  const fragment = document.createDocumentFragment();
  fragment.append(dt, dd);
  return fragment;
}

function ensureDialog() {
  if (dialog && dialog.isConnected) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "product-modal";
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "product-modal-title");
  // Every value below is written with textContent, never innerHTML. Product
  // names and details come from the catalogue, and a name containing < or & must
  // not be able to inject markup into the page.
  dialog.innerHTML = `
    <div class="product-modal__panel">
      <header class="product-modal__head">
        <h2 class="product-modal__title" id="product-modal-title"></h2>
        <button class="product-modal__close" type="button" data-modal-close aria-label="Close product details">&times;</button>
      </header>
      <div class="product-modal__body">
        <img class="product-modal__image" alt="" />
        <dl class="product-modal__specs"></dl>
        <div class="product-modal__details"></div>
      </div>
      <footer class="product-modal__foot">
        <button class="btn btn-primary" type="button" data-modal-add></button>
      </footer>
    </div>
  `;

  dialog.addEventListener("click", (event) => {
    // ::backdrop is a pseudo-element and never receives events, so a click that
    // lands on the dialog element itself is a click on the backdrop. Comparing
    // the target is the standard way to tell that apart from a click inside.
    if (event.target === dialog || event.target.closest("[data-modal-close]")) {
      dialog.close();
    }
  });

  document.body.appendChild(dialog);
  return dialog;
}

/**
 * Open the modal for one product.
 *
 * @param {object} product            as returned by GET /api/v1/products/
 * @param {object} [options]
 * @param {string} [options.imageUrl] overrides product.image_url
 * @param {string} [options.currency] price prefix, default GH₵
 */
export function openProductModal(product, options = {}) {
  if (!product) return;
  const el = ensureDialog();

  const price = Number(product.price || 0);
  const inStock = Number(product.stock || 0) > 0;
  const details = String(product.details || "").trim();
  const imageSrc = options.imageUrl || product.image_url || "assets/img/placeholder.svg";

  el.querySelector("#product-modal-title").textContent = product.name || "Product";

  const image = el.querySelector(".product-modal__image");
  image.src = imageSrc;
  image.alt = product.name || "Product image";

  el.querySelector(".product-modal__specs").replaceChildren(
    specRow("SKU", product.sku || "—"),
    specRow("Availability", inStock ? `In stock (${product.stock} available)` : "Sold out"),
    specRow("Price", `${options.currency || "GH₵"} ${price.toLocaleString()}`)
  );

  const detailsBox = el.querySelector(".product-modal__details");
  detailsBox.textContent = details || "No additional details for this product.";
  detailsBox.classList.toggle("is-empty", !details);

  const addButton = el.querySelector("[data-modal-add]");
  addButton.textContent = inStock ? "Add to cart" : "Sold out";
  addButton.disabled = !inStock;
  // Same attribute the card uses, so the existing delegated handler works.
  addButton.setAttribute("data-add-cart", product.id);

  // showModal() is what provides the focus trap, Escape-to-close and the
  // inert background. Calling it while already open throws, hence the guard.
  if (!el.open) {
    if (typeof el.showModal === "function") {
      el.showModal();
    } else {
      // Very old browsers: no focus trap, no Escape. Acceptable degradation,
      // and the reason the native path is preferred wherever it exists.
      el.setAttribute("open", "");
    }
  }
}

/** Close the modal if it is open. */
export function closeProductModal() {
  if (dialog && dialog.open) dialog.close();
}
