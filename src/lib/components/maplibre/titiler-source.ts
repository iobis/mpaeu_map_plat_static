/**
 * titiler-source.ts
 *
 * Builds MapLibre-native raster tile URLs against a TiTiler COG endpoint
 * (https://github.com/developmentseed/titiler) — standard WebMercatorQuad
 * XYZ tiles, no custom protocol needed at all.
 *
 * Why titiler instead of the client-side geotiff.js protocol this project
 * used previously: that hand-rolled protocol read a pixel window per output
 * tile and resampled it onto the tile
 * linearly in degree-space. That's a fine approximation at high zoom (a tile
 * spans a tiny latitude range), but at low zoom — a whole-globe view — one
 * tile spans a huge latitude range and Mercator's projection is strongly
 * non-linear there, so the linear resample produced visible distortion.
 * TiTiler resamples through GDAL/rasterio's real warp machinery (correct at
 * every zoom level, and with the same mature dateline handling that makes
 * this a non-issue for the antimeridian overhang too), at the cost of no
 * longer being a zero-backend static site.
 *
 * Colour mapping now happens server-side (titiler's `colormap_name` /
 * `colormap` params), not in the browser — a plain MapLibre raster source's
 * `tiles` URL can be swapped via `RasterTileSource.setTiles()` exactly as
 * before, so recolouring is still just a URL change with no other app-level
 * change needed.
 */

import type { ColormapName } from '@developmentseed/deck.gl-raster/gpu-modules';

export interface TitilerTileParams {
	/** 1-indexed band (matches GDAL/rio-tiler convention). */
	bandIndex1Based?: number;
	vmin?: number;
	vmax?: number;
	colormap?: ColormapName;
	/** Renders as a binary step mask: values below `maskThreshold` -> `maskColor`, values at/above it -> fully transparent. */
	mask?: boolean;
	maskThreshold?: number;
	/** Hex, with or without '#'. */
	maskColor?: string;
	/** Flat fill colour for single-value rasters — hex, with or without '#'. Skips the colormap entirely. */
	singleColor?: string;
	/** Raw pixel value -> [r,g,b,a], sent to titiler as-is (its `colormap` param). Takes precedence over `colormap`/`vmin`/`vmax`. */
	discreteColormap?: Record<number, [number, number, number, number]>;
	/** RasterIO resampling algorithm. @default 'bilinear' for continuous data, forced to 'nearest' for mask/singleColor/discreteColormap. */
	resampling?: 'nearest' | 'bilinear' | 'cubic';
}

/** Builds a `discreteColormap` LUT for every integer in [min,max] linearly interpolated between two hex colours — mirrors Shiny's 2-colour `leaflet::colorNumeric` gradient (e.g. the thermal-envelope / habitat "binary" layers' `binary_palette`), which titiler has no direct named equivalent for. */
export function linearColormap(min: number, max: number, fromHex: string, toHex: string, alpha = 255): Record<number, [number, number, number, number]> {
	const [r1, g1, b1] = hexToRgbTuple(fromHex);
	const [r2, g2, b2] = hexToRgbTuple(toHex);
	const lo = Math.floor(min);
	const hi = Math.max(lo, Math.ceil(max));
	const out: Record<number, [number, number, number, number]> = {};
	for (let v = lo; v <= hi; v++) {
		const t = hi === lo ? 0 : (v - lo) / (hi - lo);
		out[v] = [Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t), alpha];
	}
	return out;
}

// Every exported URL builder below interpolates `${titilerBaseUrl}/cog/...` —
// if the configured base URL itself ends in a slash (an easy, common
// mistake: `https://titiler.example.org/` instead of `.../org`), plain
// concatenation produces a double slash (`.../org//cog/...`) that titiler's
// router doesn't match, returning a 404 whose response — since it's an
// unmatched route, not a real endpoint — carries no CORS headers either, so
// the browser reports it as a CORS failure on top of the 404. Stripping any
// trailing slash(es) here means the configured value works either way.
function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, '');
}

function hex(v: string): string {
	return v.replace('#', '');
}

function hexToRgbTuple(v: string): [number, number, number] {
	const n = parseInt(hex(v), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Build a titiler `/cog/tiles/WebMercatorQuad/{z}/{x}/{y}` URL template for a
 * MapLibre raster source's `tiles` array.
 *
 * @param titilerBaseUrl e.g. 'http://localhost:8000' (no trailing slash)
 * @param cogUrl the COG's own HTTPS URL (titiler reads it directly, same as
 *   the browser did before — no re-hosting/proxying of the data itself)
 */
export function titilerTileUrlTemplate(titilerBaseUrl: string, cogUrl: string, opts: TitilerTileParams = {}): string {
	const params = new URLSearchParams();
	params.set('url', cogUrl);
	params.set('bidx', String(opts.bandIndex1Based ?? 1));

	if (opts.mask) {
		const [r, g, b] = hexToRgbTuple(opts.maskColor ?? '#d4dadc');
		const threshold = opts.maskThreshold ?? 0.5;
		// Discrete colormap keyed by exact raw pixel value (masks are stored as
		// plain 0/1 integers): below threshold -> opaque grey, at/above -> alpha 0
		// (fully transparent, letting whatever is stacked below show through).
		const colormap: Record<string, [number, number, number, number]> = {};
		for (let v = 0; v < 256; v++) {
			colormap[v] = v < threshold ? [r, g, b, 255] : [0, 0, 0, 0];
		}
		params.set('colormap', JSON.stringify(colormap));
		params.set('resampling', 'nearest'); // never blend across the mask's hard edge
	} else if (opts.singleColor) {
		const [r, g, b] = hexToRgbTuple(opts.singleColor);
		// Single value in, single value out: map every observed value to the
		// same flat colour (any nodata pixel is handled by titiler itself and
		// never reaches the colormap).
		params.set('colormap', JSON.stringify({ 0: [r, g, b, 255], 1: [r, g, b, 255], 2: [r, g, b, 255] }));
		params.set('resampling', 'nearest');
	} else if (opts.discreteColormap) {
		params.set('colormap', JSON.stringify(opts.discreteColormap));
		params.set('resampling', opts.resampling ?? 'nearest');
	} else {
		params.set('rescale', `${opts.vmin ?? 0},${opts.vmax ?? 255}`);
		if (opts.colormap) params.set('colormap_name', opts.colormap);
		params.set('resampling', opts.resampling ?? 'bilinear');
	}

	return `${stripTrailingSlash(titilerBaseUrl)}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?${params.toString()}`;
}

export interface TitilerPreviewParams {
	bandIndex1Based?: number;
	rescale?: [number, number];
	colormapName?: string;
	/** Discrete colormap: raw pixel value -> [r,g,b,a]. Takes precedence over `colormapName`/`rescale`. */
	colormap?: Record<number, [number, number, number, number]>;
	maxSize?: number;
}

/**
 * Build a titiler `/cog/preview.png` URL — a single whole-extent PNG,
 * server-rendered. Used for the "Show additional details" SHAPE/MESS
 * previews, which (like Shiny's base-R `plot()` output) are static images,
 * not something that needs pan/zoom.
 */
export function titilerPreviewUrl(titilerBaseUrl: string, cogUrl: string, opts: TitilerPreviewParams = {}): string {
	const params = new URLSearchParams();
	params.set('url', cogUrl);
	params.set('bidx', String(opts.bandIndex1Based ?? 1));
	params.set('max_size', String(opts.maxSize ?? 500));
	if (opts.colormap) {
		params.set('colormap', JSON.stringify(opts.colormap));
	} else {
		const [vmin, vmax] = opts.rescale ?? [0, 255];
		params.set('rescale', `${vmin},${vmax}`);
		if (opts.colormapName) params.set('colormap_name', opts.colormapName);
	}
	return `${stripTrailingSlash(titilerBaseUrl)}/cog/preview.png?${params.toString()}`;
}

/** Real min/max for one band — used to set a sensible `rescale` for the SHAPE preview, whose value range varies a lot per species. */
export async function fetchTitilerBandStats(titilerBaseUrl: string, cogUrl: string, bandIndex1Based: number): Promise<{ min: number; max: number }> {
	const params = new URLSearchParams({ url: cogUrl, bidx: String(bandIndex1Based) });
	const res = await fetch(`${stripTrailingSlash(titilerBaseUrl)}/cog/statistics?${params.toString()}`);
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching titiler statistics`);
	const data = (await res.json()) as Record<string, { min: number; max: number }>;
	const stats = data[`b${bandIndex1Based}`];
	if (!stats) throw new Error(`No statistics for band ${bandIndex1Based}`);
	return { min: stats.min, max: stats.max };
}
