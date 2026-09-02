export const prerender = true;
// Browser-only code (MapLibre, deck.gl, geotiff) is guarded with `if (browser)` /
// onMount, so ssr=false is a safety net rather than a required fix.
export const ssr = false;
// 'always' generates index.html per-route (needed for GitHub Pages static hosting).
export const trailingSlash = 'always';
