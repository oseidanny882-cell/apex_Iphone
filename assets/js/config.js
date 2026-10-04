// Where the API lives.
//
// Previously hardcoded to "/api/v1", which is only correct when the frontend
// and the API share one origin (the Caddy setup: the browser loaded the page,
// so the session cookie stayed first-party). That is not the deployed shape -
// the storefront is served from apexiphone-n58wdi.v2.appdeploy.ai and the API
// from apexiphone-production.up.railway.app.
//
// With a relative "/api/v1" the browser asked the *static host* for the API,
// which has no /api route. Its single-page-app fallback answered with
// index.html, so fetch() received HTML, JSON.parse() threw, and every product
// silently disappeared while the API logged a perfectly healthy 200. That is
// why this looked like a database fault for so long.
//
// The URL is therefore configurable, checked in this order:
//
//   1. window.__API_BASE__ - a <script> tag placed before any module runs.
//      Works in a built bundle without a rebuild, which is the only way to
//      repoint a deployed site that you do not control the build for.
//   2. import.meta.env.VITE_API_BASE - baked in at build time by Vite.
//   3. The value below - the deployed Railway API.
//
// Do not "fix" a CORS failure by making this relative again: the browser
// discards the response before JavaScript ever sees it, so the page renders
// empty with no error anywhere in the console.
const DEFAULT_API_BASE = "https://apexiphone-production.up.railway.app/api/v1";

const _runtime = typeof window !== "undefined" ? window.__API_BASE__ : undefined;
const _build = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined;

export const API_BASE = (_runtime || _build || DEFAULT_API_BASE).replace(/\/+$/, "");

export const CURRENCY = "GHS";