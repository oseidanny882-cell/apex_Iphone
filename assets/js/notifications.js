// Notifications: the header bell and the account page inbox.
//
// The server is the only source of truth for what a customer has been told and
// when they read it, so nothing here is optimistic: every dismissal is a POST and
// the list is re-rendered from that response, which also carries the fresh unread
// count. That is what keeps the badge and the rows from disagreeing.
//
// Poll is deliberately slow (POLL_MS) and pauses on a hidden tab. The endpoint
// returns one integer, and a faster poll would just spend the customer's battery
// to notice a status change a few seconds sooner.
import { api } from "./api.js";

const POLL_MS = 60000;

// Shown next to the title so a customer can tell an order update from a message
// without opening it. Unknown kinds fall back to the server's own title.
const KIND_LABELS = {
  "order.placed": "Order placed",
  "order.confirmed": "Order confirmed",
  "order.delivered": "Order delivered",
  "order.cancelled": "Order cancelled"
};

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function whenLabel(value) {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return String(value);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return then.toLocaleDateString();
}

// A notification link is a relative path this app writes itself, e.g.
// "order-details.html?id=...". Anything else is dropped rather than rendered:
// escHtml() escapes quotes and angle brackets, but it cannot tell a path from a
// `javascript:` URL, and a customer clicking a notification must never be able to
// run script. Same reasoning as SAFE_IMAGE_URL in app.js.
//
// Rejects an explicit scheme (javascript:, data:, https:), a protocol-relative
// "//host" URL, and anything containing characters no path we generate has.
const SAFE_LINK = /^[A-Za-z0-9._~/?#[\]@!$&'()*+,;=%-]+$/;
const FALLBACK_LINK = "account.html#notifications";

function safeLink(link) {
  const raw = String(link ?? "").trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return FALLBACK_LINK;
  return SAFE_LINK.test(raw) ? raw : FALLBACK_LINK;
}

function rowHtml(n) {
  const unread = !n.read;
  const kind = KIND_LABELS[n.kind] || "Update";
  return `
    <a class="notification-row${unread ? " is-unread" : ""}" href="${escHtml(safeLink(n.link))}"
       data-notification="${escHtml(n.id)}" data-read="${unread ? "1" : "0"}"
       style="display:grid;gap:4px;padding:12px 14px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;${unread ? "background:rgba(94,231,255,.06)" : ""}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
        <strong style="font-size:.9rem">${escHtml(n.title)}</strong>
        <span class="muted" style="font-size:.72rem;white-space:nowrap">${escHtml(whenLabel(n.created_at))}</span>
      </div>
      <span class="muted" style="font-size:.78rem">${escHtml(kind)}</span>
      ${n.body ? `<span class="muted" style="font-size:.82rem">${escHtml(n.body)}</span>` : ""}
    </a>`;
}

function emptyHtml() {
  return `<p class="muted" style="padding:20px;margin:0">Nothing here yet. Order updates will show up as they happen.</p>`;
}

function listHtml(data) {
  const items = data?.items || [];
  if (!items.length) return emptyHtml();
  return items.map(rowHtml).join("");
}

// One place to paint both the badge and any rendered list, so the two can never
// be updated from different responses.
//
// Only the list is repainted when the payload actually carries items. The badge
// endpoint returns just {"unread": n}, and treating that as an empty inbox would
// blank the panel the customer is reading every time the poll fired.
function applyState(data) {
  const unread = Number(data?.unread || 0);
  document.querySelectorAll("[data-notification-count]").forEach((el) => {
    el.textContent = unread > 9 ? "9+" : String(unread);
    el.hidden = unread === 0;
  });
  if (Array.isArray(data?.items)) {
    document.querySelectorAll("[data-notification-list]").forEach((el) => {
      el.innerHTML = listHtml(data);
    });
  }
  return unread;
}

export async function refreshNotificationBadge() {
  try {
    applyState(await api("/notifications/unread-count"));
  } catch {
    // Logged out, or the table is not migrated yet. Leave whatever is on screen.
  }
}

async function loadInto(selector) {
  const target = document.querySelector(selector);
  if (!target) return null;
  try {
    // applyState repaints every [data-notification-list] in the document, which
    // includes this one; `target` is here to fail quietly when the mount is gone
    // and to show the message when the request fails.
    const data = await api("/notifications");
    applyState(data);
    return data;
  } catch {
    target.innerHTML = `<p class="muted" style="padding:16px;margin:0">Notifications are unavailable right now.</p>`;
    return null;
  }
}

export async function markRead(id) {
  const data = await api(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
  applyState(data);
}

export async function markAllRead() {
  const data = await api("/notifications/read-all", { method: "POST" });
  applyState(data);
}

// The bell lives in the header that app.js renders, so it is wired up after the
// header exists rather than being baked into a template twice.
function buildPanel() {
  const panel = document.createElement("div");
  panel.id = "notification-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Notifications");
  panel.style.cssText =
    "position:absolute;right:0;top:calc(100% + 10px);width:min(340px,90vw);z-index:60;" +
    "background:var(--surface,rgba(15,23,42,.96));border:1px solid var(--border);" +
    "border-radius:16px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.45);" +
    "max-height:70vh;flex-direction:column";
  // Hidden until the bell is clicked.
  //
  // Both the `hidden` attribute and an inline `display:none` are set, and
  // setPanelOpen() keeps them in step. The attribute alone is not enough: the
  // panel is laid out with an inline display, and an inline style outranks the
  // user agent's `[hidden] { display: none }` rule, so `panel.hidden = true`
  // would leave it fully visible on the page.
  panel.style.display = "none";
  panel.hidden = true;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border)">
      <strong>Notifications</strong>
      <button class="btn btn-ghost" type="button" data-notification-read-all style="padding:6px 10px;font-size:.78rem">Mark all read</button>
    </div>
    <div data-notification-list style="overflow-y:auto"><p class="muted" style="padding:18px;margin:0">Loading…</p></div>`;
  return panel;
}

function setPanelOpen(open) {
  const panel = document.getElementById("notification-panel");
  if (panel) {
    panel.hidden = !open;
    panel.style.display = open ? "flex" : "none";
  }
  document.querySelector("[data-notification-bell]")?.setAttribute("aria-expanded", String(open));
}

export async function initNotificationBell() {
  const bell = document.querySelector("[data-notification-bell]");
  if (!bell) return;

  const wrap = bell.closest(".nav-actions") || bell.parentElement;
  if (wrap) wrap.style.position = "relative";
  const panel = buildPanel();
  wrap?.appendChild(panel);
  // Establish the closed state (and aria-expanded="false") here rather than relying
  // on the attributes in app.js's header markup, so the panel and the button can
  // never disagree about whether the dropdown is open.
  setPanelOpen(false);

  const wasOpen = () => panel.hidden === false;

  bell.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const open = !wasOpen();
    setPanelOpen(open);
    // Fetch on open rather than on every poll: the panel should never show rows
    // that are already stale from the last background refresh.
    if (open) await loadInto("[data-notification-list]");
  });

  // A click anywhere else closes the panel, the same way the mobile nav does.
  document.addEventListener("click", (event) => {
    if (wasOpen() && !panel.contains(event.target) && event.target !== bell) setPanelOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && wasOpen()) setPanelOpen(false);
  });

  // Opening a row dismisses it. The POST is fire-and-forget because the link
  // navigates immediately; the badge is corrected on the next page load.
  panel.addEventListener("click", (event) => {
    const row = event.target.closest("[data-notification][data-read='1']");
    if (row) markRead(row.dataset.notification).catch(() => {});
    if (event.target.closest("[data-notification-read-all]")) {
      event.preventDefault();
      markAllRead().catch(() => {});
    }
  });

  await refreshNotificationBadge();
  setInterval(() => {
    if (!document.hidden) refreshNotificationBadge();
  }, POLL_MS);
  // A tab that was in the background is usually the one where the customer
  // missed the update, so re-check the moment it is looked at again.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshNotificationBadge();
  });
}

// The full inbox on the account page, with the same rows the bell shows.
export async function renderNotificationInbox() {
  const mount = document.querySelector("#notifications");
  if (!mount || !window.location.pathname.endsWith("account.html")) return;

  mount.innerHTML = `
    <div class="soft-panel" style="padding:20px;margin-top:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 style="margin:0">Notifications</h2>
        <button class="btn btn-ghost" type="button" data-inbox-read-all>Mark all read</button>
      </div>
      <div data-notification-list style="margin-top:12px;border:1px solid var(--border);border-radius:13px;overflow:hidden">
        <p class="muted" style="padding:18px;margin:0">Loading…</p>
      </div>
    </div>`;

  mount.querySelector("[data-inbox-read-all]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await markAllRead();
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  // Same delegated handler as the panel: mark on open, then let the link navigate.
  mount.querySelector("[data-notification-list]").addEventListener("click", (event) => {
    const row = event.target.closest("[data-notification][data-read='1']");
    if (row) markRead(row.dataset.notification).catch(() => {});
  });

  await loadInto("#notifications [data-notification-list]");
}
