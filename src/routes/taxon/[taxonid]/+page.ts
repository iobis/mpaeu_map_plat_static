// This route's whole point is one URL per taxonID (12,000+ of them) — letting
// the root layout's `prerender = true` apply here would mean either
// prerendering one static file per species (a huge, pointless build for a
// page that's fully client-rendered anyway, `ssr = false`) or SvelteKit
// failing the build entirely without an `entries()` export enumerating every
// id. Opting out here means this route is served by adapter-static's
// `fallback: '404.html'` instead (see svelte.config.js) — the same mechanism
// GitHub Pages / nginx.conf already fall back to for any unmatched path, so
// a direct link to /taxon/137080/ resolves client-side with no extra config.
export const prerender = false;
