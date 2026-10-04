# Apex iPhone — Storefront

The customer-facing storefront: static HTML/CSS/JavaScript pages bundled with
Vite and published to GitHub Pages.

The API is a separate FastAPI service (Railway) — the repository `apexiphone`
holds it, along with the admin panel.

## Pages URL

Once the Pages workflow has run:

```
https://oseidanny882-cell.github.io/apex_Iphone/
```

## Local development

```bash
npm ci
npm run dev      # vite dev server
npm run build    # emits dist/
npm run preview  # serve the built dist/
```

## Connecting to the API

`assets/js/config.js` decides where the API lives, checked in this order:

1. `window.__API_BASE__` — set before any module runs, so a deployed site can be
   repointed without a rebuild.
2. `import.meta.env.VITE_API_BASE` — baked in at build time.
3. The built-in default, the deployed Railway API.

```bash
# build against a different API
VITE_API_BASE=http://localhost:8000/api/v1 npm run build
```

**Why this is not a relative `/api/v1`:** that only works when the page and the
API share one origin. On a separate host the browser asks the *static* host for
`/api/v1`, which has no such route; the single-page-app fallback answers with
`index.html`, `fetch()` receives HTML, `JSON.parse()` throws, and every product
silently disappears while the API logs a healthy 200.

## Deployment

`.github/workflows/pages.yml` builds with `npm ci && npm run build` and deploys
`dist/` to GitHub Pages on every push to `main`.

`public/.nojekyll` and `public/404.html` are copied into `dist/` by Vite. Both
are required: without `.nojekyll` Jekyll strips directories beginning with `_`,
and without `404.html` a bad URL shows GitHub's error page instead of the site.

## A note on authentication

The session cookie is `SameSite=Lax`, so the browser sends it only for
same-site requests. GitHub Pages (`github.io`) and the API (`railway.app`) are
different registrable domains, so **browsing works but login and the cart will
return 401**. Serving the storefront from `*.up.railway.app` puts both on the
same site and fixes it without any code change.