import { requireAdmin, adminApi } from "./admin-guard.js";
import { API_BASE } from "./config.js";
await requireAdmin();
const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const form = document.querySelector("#product-form");
const msg = document.querySelector("[data-msg]");
const title = document.querySelector("[data-title]");
const crumb = document.querySelector("[data-crumb]");
const navLabel = document.querySelector("[data-nav-label]");
const fileInput = document.querySelector("[data-image]");
const urlInput = document.querySelector("[data-image-url]");
const preview = document.querySelector("[data-preview]");
const dropZone = document.querySelector(".img-drop");
let uploadedUrl = "";
function setPreview(src) { if (preview && src) preview.src = src; }
function say(text) { if (msg) msg.textContent = text; }

// The one upload path, shared by the file picker, a paste and a drop, so all
// three inherit the same server-side checks: 5MB cap, magic-byte sniffing and
// JPG/PNG/WebP only. Returns the stored /api/v1/uploads/products/... path.
async function uploadImage(file) {
  if (!file) return null;
  // Checked here as well as server-side: the API answers a zero-byte file with a
  // bare 422 "Empty image file", which is a round-trip and a dead end for the
  // person filling the form in. A clipboard paste can easily produce one.
  if (file.size === 0) throw new Error("That file is empty — pick or paste a different image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
  const fd = new FormData();
  fd.append("file", file, file.name || "pasted-image");
  const r = await fetch(API_BASE + "/admin/uploads/image", { method: "POST", credentials: "include", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Image upload failed");
  return d.image_url;
}

// Take an image from a paste or a drop, upload it straight away, and make it
// the image the form will save. Last action wins: the picker, a paste and a
// drop each clear the others, so there is never a stale file fighting the new one.
async function ingestImage(file) {
  try {
    say("Uploading image…");
    const url = await uploadImage(file);
    uploadedUrl = url;
    if (urlInput) urlInput.value = "";
    if (fileInput) fileInput.value = "";
    setPreview(URL.createObjectURL(file));
    say("Image ready — save the product to keep it");
  } catch (err) {
    say(err.message);
  }
}

// Browsers that copy an image as a data: URI text (Firefox, DevTools, some
// right-click menus) put something on the clipboard that is not a URL. Turn it
// back into a real file so it can be uploaded instead of being pasted into the
// URL box, where it used to fail the 2000-character limit.
function dataUriToFile(text) {
  const m = /^\s*data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(text || "");
  if (!m) return null;
  try {
    const mime = m[1].toLowerCase();
    const binary = atob(m[2].replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime] || "img";
    return new File([bytes], `pasted-image.${ext}`, { type: mime });
  } catch {
    return null; // malformed base64, or too large to hold as a string
  }
}

fileInput?.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) { setPreview(URL.createObjectURL(f)); if (urlInput) urlInput.value = ""; say(""); }
});
urlInput?.addEventListener("input", () => { if (!fileInput?.files?.length && urlInput.value.trim()) setPreview(urlInput.value.trim()); });

// Ctrl+V anywhere on the page. Only intercepted when the clipboard really holds
// an image, so pasting text into the name or details box is untouched.
document.addEventListener("paste", async (e) => {
  for (const item of e.clipboardData?.items || []) {
    if (item.type?.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) { e.preventDefault(); await ingestImage(f); return; }
    }
  }
  const text = e.clipboardData?.getData("text/plain") || "";
  if (/^\s*data:image\//i.test(text)) {
    e.preventDefault();
    const f = dataUriToFile(text);
    if (!f) { say("That image could not be read — save it to a file and use the file field"); return; }
    await ingestImage(f);
  }
});

// The .img-drop box is styled as a drop zone, so make it actually accept a drop.
if (dropZone) {
  const mark = (on) => dropZone.classList.toggle("is-dragover", on);
  ["dragenter", "dragover"].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); mark(true); }));
  ["dragleave", "dragend", "drop"].forEach((ev) => dropZone.addEventListener(ev, () => mark(false)));
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) await ingestImage(f);
  });
}
if (id) {
  if (title) title.textContent = "Edit product";
  if (crumb) crumb.textContent = "Edit product";
  if (navLabel) navLabel.textContent = "Edit product";
    try {
    const p = await adminApi("/admin/products/" + id);
    if (p) {
      form.name.value = p.name;
      form.sku.value = p.sku;
      form.sku.disabled = true;
      form.price.value = p.price;
      form.stock.value = p.stock;
      form.active.checked = !!p.active;
      if (p.details != null) form.details.value = p.details;
      if (p.image_url) {
        urlInput.value = p.image_url;
        let src = p.image_url;
        if (src.startsWith("/api/")) src = ".." + src;
        setPreview(src);
        uploadedUrl = p.image_url;
      }
    }
  } catch (e) { if (msg) msg.textContent = e.message; }
}
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = form.querySelector("button[type=submit]");
  const name = form.name.value.trim();
  const sku = form.sku.value.trim();
  const price = Number(form.price.value);
  const stock = Number(form.stock.value);
  // Check the same rules the API enforces, before anything is sent. Number("") is
  // 0, so an empty price or stock field used to be posted as a real 0 and come
  // back as an opaque 422 - after an image had already been uploaded.
  const stop = (text, field) => { if (msg) msg.textContent = text; field?.focus(); };
  if (!name) return stop("Name is required", form.name);
  if (!id && !sku) return stop("SKU is required", form.sku);
  if (form.price.value.trim() === "" || !Number.isFinite(price) || price <= 0) {
    return stop("Price must be greater than 0", form.price);
  }
  if (form.stock.value.trim() === "" || !Number.isInteger(stock) || stock < 0) {
    return stop("Stock must be 0 or more", form.stock);
  }
  // The API allows up to 2000 characters and refuses inline data: URIs, which the
  // storefront cannot render anyway. Checked before the upload so a bad URL does
  // not cost an image upload first. Skipped when a file is chosen, because the
  // upload result then overrides whatever is typed here.
  const typedUrl = urlInput.value.trim();
  if (!fileInput?.files?.length && typedUrl) {
    if (typedUrl.toLowerCase().startsWith("data:")) {
      return stop("That is an image, not a link — paste the picture itself (Ctrl+V) or use the file field", urlInput);
    }
    if (typedUrl.length > 2000) {
      return stop(`Image URL is too long (${typedUrl.length} characters, max 2000)`, urlInput);
    }
  }
  btn.disabled = true;
  say("Saving…");
  try {
    let image_url = urlInput.value.trim() || uploadedUrl || null;
    const f = fileInput?.files?.[0];
    if (f) image_url = await uploadImage(f);
    const body = { name, price, stock, active: form.active.checked, image_url, details: form.details?.value.trim() || null };
    if (id) {
      await adminApi("/admin/products/" + id, { method: "PATCH", body: JSON.stringify(body) });
    } else {
      body.sku = sku;
      await adminApi("/admin/products", { method: "POST", body: JSON.stringify(body) });
    }
    window.location.href = "products.html";
  } catch (err) { if (msg) msg.textContent = err.message; btn.disabled = false; }
});
