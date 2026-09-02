<script lang="ts">
	/**
	 * RasterLayer.svelte
	 *
	 * A native MapLibre `raster` source + layer backed by a TiTiler COG tile
	 * endpoint (see titiler-source.ts). Follows the same add/update/remove-on-
	 * destroy pattern as PointLayer.svelte: since RasterTileSource.setTiles()
	 * lets the tile URL template be swapped in place, a band change, colormap
	 * change, or mask toggle never needs to remove/recreate the source or
	 * layer — only opacity/visibility use a plain paint property (instant, no
	 * tile rebuild at all). Recolouring/rescaling *does* now hit the network
	 * (titiler renders the coloured PNG server-side), unlike the client-side
	 * protocol this replaced — titiler's own HTTP cache headers and any CDN in
	 * front of it are the mitigation for that, not an app-level cache.
	 */
	import { getContext, onDestroy } from 'svelte';
	import type maplibregl from 'maplibre-gl';
	import { MAP_CONTEXT_KEY, type MapContext } from './context.js';
	import { titilerTileUrlTemplate } from './titiler-source.js';
	import type { ColormapName } from '@developmentseed/deck.gl-raster/gpu-modules';

	interface Props {
		id: string;
		/** The COG's own HTTPS URL — titiler reads it directly. */
		url: string;
		/** Base URL of the titiler service, e.g. 'http://localhost:8000'. */
		titilerBaseUrl: string;
		/** 0-indexed band; converted to the 1-indexed `bidx` titiler expects. */
		bandIndex?: number;
		opacity?: number;
		visible?: boolean;
		colormap?: ColormapName;
		dataMin?: number;
		dataMax?: number;
		/** Renders as a binary step mask (see titiler-source.ts) instead of a gradient. */
		maskMode?: boolean;
		maskColor?: string;
		maskThreshold?: number;
		/** Flat fill colour for single-value rasters — skips the colormap entirely. */
		singleColor?: string;
		/** Raw pixel value -> [r,g,b,a] LUT (see titiler-source.ts's `linearColormap`) — takes precedence over `colormap`. */
		discreteColormap?: Record<number, [number, number, number, number]>;
		/** Insert this layer immediately below an existing layer id, for z-order control. */
		beforeId?: string;
		tileSize?: number;
	}

	let {
		id,
		url,
		titilerBaseUrl,
		bandIndex = 0,
		opacity = 0.85,
		visible = true,
		colormap,
		dataMin = 0,
		dataMax = 255,
		maskMode = false,
		maskColor,
		maskThreshold,
		singleColor,
		discreteColormap,
		beforeId,
		tileSize = 256
	}: Props = $props();

	const ctx = getContext<MapContext>(MAP_CONTEXT_KEY);

	function buildUrl(): string {
		return titilerTileUrlTemplate(titilerBaseUrl, url, {
			bandIndex1Based: bandIndex + 1,
			vmin: dataMin,
			vmax: dataMax,
			colormap,
			mask: maskMode,
			maskThreshold,
			maskColor,
			singleColor,
			discreteColormap
		});
	}

	function addLayer(map: maplibregl.Map) {
		if (!map.getSource(id)) {
			map.addSource(id, {
				type: 'raster',
				tiles: [buildUrl()],
				tileSize,
				bounds: [-180, -90, 180, 90]
			});
		}
		if (!map.getLayer(id)) {
			// No beforeId here: a sibling RasterLayer that should stack above
			// this one (e.g. this layer's own mask) may not have created its
			// layer yet, and MapLibre throws if beforeId doesn't exist. Instead,
			// always append to the current top; correct initial order falls out
			// naturally when parent-then-mask mount in that same order (each
			// append lands above the previous one). The reposition effect below
			// handles later reordering (e.g. drag-and-drop in the layer panel).
			map.addLayer({
				id,
				type: 'raster',
				source: id,
				paint: {
					'raster-opacity': visible ? opacity : 0,
					'raster-fade-duration': 0
				}
			});
		}
	}

	$effect(() => {
		const map = ctx.map;
		if (!map) return;
		addLayer(map);
	});

	// Any prop that changes pixel content (band/range/colormap/mask) rebuilds
	// the tile URL via setTiles() — MapLibre re-requests visible tiles, this
	// time from titiler rather than a local cache.
	$effect(() => {
		const map = ctx.map;
		const source = map?.getSource(id) as maplibregl.RasterTileSource | undefined;
		if (!source) return;
		source.setTiles([buildUrl()]);
	});

	$effect(() => {
		const map = ctx.map;
		if (!map || !map.getLayer(id)) return;
		map.setPaintProperty(id, 'raster-opacity', visible ? opacity : 0);
	});

	// Reposition within the native layer stack when `beforeId` changes (e.g.
	// the user drag-reorders layers in the panel). Guarded on both ids
	// actually existing yet: on the same render pass a new layer is added,
	// a sibling's `beforeId` may transiently point at a not-yet-created
	// layer — this effect will simply no-op that time and settle correctly
	// once both layers exist and `beforeId` (or entries order) next changes.
	$effect(() => {
		const map = ctx.map;
		if (!map || !map.getLayer(id)) return;
		if (beforeId !== undefined && !map.getLayer(beforeId)) return;
		map.moveLayer(id, beforeId);
	});

	onDestroy(() => {
		const map = ctx.map;
		if (!map) return;
		if (map.getLayer(id)) map.removeLayer(id);
		if (map.getSource(id)) map.removeSource(id);
	});
</script>
