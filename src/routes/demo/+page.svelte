<script lang="ts">
	import { Map, RasterLayer, DeckOverlay } from '$lib/components/maplibre/index.js';
	import type { OverlayEntry, VectorEntry, TableEntry } from '$lib/components/maplibre/DeckOverlay.svelte';
	import type { VectorLayerProps } from '$lib/components/maplibre/vector-layer-builder.js';
	import type { ColormapName } from '@developmentseed/deck.gl-raster/gpu-modules';
	import LayerCatalogue from '$lib/components/LayerCatalogue.svelte';
	import LayerPanel from '$lib/components/LayerPanel.svelte';
	import { activeLayers } from '$lib/stores/activeLayers.svelte.js';
	import { SINGLE_COLOR_HEX, type LayerType } from '$lib/data/layers.js';
	import { PUBLIC_TITILER_URL } from '$env/static/public';

	function typeToGeomKind(type: LayerType): VectorLayerProps['geomKind'] {
		if (type === 'vector-point') return 'geojson-point';
		if (type === 'vector-line') return 'geojson-line';
		return 'geojson-polygon';
	}

	interface RasterStackItem {
		id: string;
		url: string;
		bandIndex: number;
		opacity: number;
		visible: boolean;
		colormap: ColormapName;
		dataMin: number;
		dataMax: number;
		maskMode: boolean;
		maskColor?: string;
		maskThreshold?: number;
		singleColor?: string;
	}

	// ── Native raster stack ────────────────────────────────────────────────────
	// Each active raster contributes its own layer plus (if visible) a mask
	// layer stacked immediately above it. Order matches activeLayers.layers
	// (bottom to top); `beforeId` is recomputed whenever order changes so
	// drag-reordering in the panel actually repositions the native layers.
	const rasterStack = $derived.by((): RasterStackItem[] => {
		const items: RasterStackItem[] = [];
		for (const l of activeLayers.layers) {
			if (l.config.type !== 'raster') continue;
			const s = l.settings;
			items.push({
				id: l.config.id,
				url: l.config.url,
				bandIndex: s.bandIndex,
				opacity: s.opacity,
				visible: s.visible,
				colormap: s.colormap,
				dataMin: s.dataMin,
				dataMax: s.dataMax,
				maskMode: false,
				singleColor: l.config.isSingleValue ? SINGLE_COLOR_HEX[s.singleColor] : undefined
			});
			if (l.config.maskUrl && s.maskVisible) {
				items.push({
					id: `${l.config.id}__mask`,
					url: l.config.maskUrl,
					bandIndex: s.maskBandIndex,
					opacity: s.opacity,
					visible: s.visible,
					colormap: 'blues',
					dataMin: 0,
					dataMax: 1,
					maskMode: true,
					maskColor: '#d4dadc',
					maskThreshold: 0.5
				});
			}
		}
		return items;
	});

	// ── deck.gl overlay entries (vector polygon/line/point + table-point) ──────
	const overlayEntries = $derived<OverlayEntry[]>(
		activeLayers.layers
			.map((l, zIndex): OverlayEntry | null => {
				if (l.config.type === 'raster') return null;
				if (l.config.type === 'table-point') {
					return {
						layerKind: 'table',
						zIndex,
						id: l.config.id,
						url: l.config.url,
						lonField: l.config.lonField ?? 'lon',
						latField: l.config.latField ?? 'lat',
						opacity: l.settings.opacity,
						visible: l.settings.visible
					} satisfies TableEntry;
				}
				return {
					layerKind: 'vector',
					zIndex,
					id: l.config.id,
					url: l.config.url,
					geomKind: typeToGeomKind(l.config.type),
					opacity: l.settings.opacity,
					visible: l.settings.visible,
					categoryField: l.config.categoryField,
					colorMap: l.settings.resolvedColorMap ?? l.config.colorMap
				} satisfies VectorEntry;
			})
			.filter((e): e is OverlayEntry => e !== null)
	);

	let loadingIds = $state<string[]>([]);
	let errorIds = $state<string[]>([]);

	function handleAutoDetect(id: string, _field: string, colorMap: Record<string, string>) {
		activeLayers.updateSettings(id, { resolvedColorMap: colorMap });
	}
</script>

<svelte:head><title>MPA Europe — Map Infrastructure Demo</title></svelte:head>

<!--
	Phase 1 validation harness — the generic multi-layer catalogue/stack UI
	used to prove out the raster/vector/mask/compare infrastructure. Kept
	here (moved off "/") once the real app shell (Shiny-a-like layout,
	species tab) landed on "/", since it's still useful for exercising any
	layer kind end-to-end without going through the species-specific flow.
-->

<div class="app">
	<LayerCatalogue />

	<div class="map-wrapper">
		<Map bounds={[-33, 25, 40, 72]}>
			{#each rasterStack as item, i (item.id)}
				<RasterLayer
					id={item.id}
					url={item.url}
					titilerBaseUrl={PUBLIC_TITILER_URL}
					bandIndex={item.bandIndex}
					opacity={item.opacity}
					visible={item.visible}
					colormap={item.colormap}
					dataMin={item.dataMin}
					dataMax={item.dataMax}
					maskMode={item.maskMode}
					maskColor={item.maskColor}
					maskThreshold={item.maskThreshold}
					singleColor={item.singleColor}
					beforeId={rasterStack[i + 1]?.id}
				/>
			{/each}
			<DeckOverlay entries={overlayEntries} bind:loadingIds bind:errorIds onAutoDetect={handleAutoDetect} />
		</Map>

		<LayerPanel {loadingIds} {errorIds} />
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
		background: #f6f6f6;
		color: #184e77;
	}
	.app { display: flex; height: 100dvh; overflow: hidden; }
	.map-wrapper { flex: 1; position: relative; }
</style>
