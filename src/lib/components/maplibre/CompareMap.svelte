<script lang="ts">
	/**
	 * CompareMap.svelte
	 *
	 * Side-by-side raster comparison (e.g. "Current" vs a future scenario),
	 * matching the current Shiny app's split-viewer UX: one synced viewport
	 * with a draggable swipe divider, not two independently pannable maps.
	 *
	 * Built on compare-sync.ts (hand-rolled — see that file for why not the
	 * @maplibre/maplibre-gl-compare npm package): clips each map's container
	 * element via CSS `clip-path` (not the legacy `clip` property — that one
	 * only applies to absolutely/fixed-positioned elements, and each map's
	 * container is `position: relative`, so it silently no-ops in
	 * spec-compliant browsers) and mirrors camera movement between the two
	 * `maplibregl.Map` instances with a re-entrancy guard. Clipping the
	 * container clips both the base MapLibre canvas AND any deck.gl overlay
	 * canvas mounted inside it (that canvas is a sibling DOM node within the
	 * same container), so vector/point layers on either side swipe correctly
	 * too, with no special-casing.
	 *
	 * `Map.svelte`'s context-based single-map assumption needs no change here:
	 * two independent <Map> instances, each with its own children, simply
	 * don't collide (context is scoped per component-instantiation-tree, and
	 * DeckOverlay's shared colormap-sprite fetch is a module-scope singleton
	 * safely reused by both).
	 */
	import { onDestroy, type Snippet } from 'svelte';
	import type maplibregl from 'maplibre-gl';
	import Map from './Map.svelte';
	import { createCompare, type CompareHandle } from './compare-sync.js';

	interface Props {
		center?: [number, number];
		zoom?: number;
		bounds?: maplibregl.LngLatBoundsLike;
		orientation?: 'vertical' | 'horizontal';
		/** Left/top map's children (e.g. a RasterLayer for the "before" layer). */
		left?: Snippet;
		/** Right/bottom map's children (e.g. a RasterLayer for the "after" layer). */
		right?: Snippet;
	}

	let { center = [0, 0], zoom = 2, bounds = undefined, orientation = 'vertical', left, right }: Props = $props();

	let container: HTMLDivElement;
	let mapA = $state<maplibregl.Map | undefined>(undefined);
	let mapB = $state<maplibregl.Map | undefined>(undefined);
	let compare: CompareHandle | undefined;

	$effect(() => {
		if (!mapA || !mapB || compare) return;
		compare = createCompare(mapA, mapB, container, { orientation });
	});

	onDestroy(() => {
		compare?.remove();
		compare = undefined;
	});
</script>

<div bind:this={container} class="compare-wrap">
	<div class="compare-map">
		<Map {center} {zoom} {bounds} onMapLoad={(m) => (mapA = m)}>
			{@render left?.()}
		</Map>
	</div>
	<div class="compare-map">
		<Map {center} {zoom} {bounds} onMapLoad={(m) => (mapB = m)}>
			{@render right?.()}
		</Map>
	</div>
</div>

<style>
	.compare-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.compare-map {
		position: absolute;
		inset: 0;
	}

	:global(.maplibre-compare) {
		background-color: #fff;
		position: absolute;
		width: 2px;
		height: 100%;
		z-index: 1;
	}
	:global(.maplibre-compare-horizontal) {
		width: 100%;
		height: 2px;
	}
	:global(.compare-swiper-vertical),
	:global(.compare-swiper-horizontal) {
		background-color: #006cd7;
		box-shadow: inset 0 0 0 2px #fff;
		border-radius: 50%;
		position: absolute;
		width: 34px;
		height: 34px;
		top: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 0.9rem;
	}
	:global(.compare-swiper-vertical) {
		left: -17px;
		margin-top: -17px;
		cursor: ew-resize;
	}
	:global(.compare-swiper-vertical)::before {
		content: '↔';
	}
	:global(.compare-swiper-horizontal) {
		left: 50%;
		margin: -17px 0 0 -17px;
		cursor: ns-resize;
	}
	:global(.compare-swiper-horizontal)::before {
		content: '↕';
	}
</style>
