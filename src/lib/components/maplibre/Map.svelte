<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { setContext, onMount, type Snippet } from 'svelte';
	import { MAP_CONTEXT_KEY } from './context.js';

	const OBIS_BASEMAP: maplibregl.StyleSpecification = {
		version: 8,
		glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
		sources: {
			land_polygons: {
				type: 'vector',
				tiles: ['https://tiles.obis.org/land_tiles/{z}/{x}/{y}.pbf'],
				minzoom: 0,
				maxzoom: 14
			},
			coastlines: {
				type: 'vector',
				tiles: ['https://tiles.obis.org/coastlines_tiles/{z}/{x}/{y}.pbf'],
				minzoom: 0,
				maxzoom: 14
			}
		},
		layers: [
			{
				id: 'background',
				type: 'background',
				paint: { 'background-color': '#e8ecf0' }
			},
			{
				id: 'land_polygons',
				type: 'fill',
				source: 'land_polygons',
				'source-layer': 'land',
				paint: { 'fill-color': '#f8fafc', 'fill-opacity': 1 }
			},
			{
				id: 'coastlines',
				type: 'line',
				source: 'coastlines',
				'source-layer': 'coastlines',
				paint: { 'line-color': '#334155', 'line-width': 0.4, 'line-opacity': 0.85 }
			}
		]
	};

	interface Props {
		style?: string | maplibregl.StyleSpecification;
		center?: [number, number];
		zoom?: number;
		bounds?: maplibregl.LngLatBoundsLike;
		/**
		 * Whether panning past +-180 shows repeated copies of the world.
		 * Default true (MapLibre's own default) — flip to false if the deck.gl
		 * overlay proves not to redraw correctly into repeated world copies
		 * (see antimeridian spike notes).
		 */
		renderWorldCopies?: boolean;
		class?: string;
		children?: Snippet;
		/**
		 * Fired once when the underlying maplibregl.Map instance is ready
		 * (same point `map` becomes truthy below). Lets a parent that renders
		 * multiple sibling <Map> instances (e.g. CompareMap) get hold of both
		 * raw instances without a second context mechanism.
		 */
		onMapLoad?: (map: maplibregl.Map) => void;
	}

	let {
		style = OBIS_BASEMAP,
		center = [0, 0],
		zoom = 2,
		bounds = undefined,
		renderWorldCopies = true,
		class: className = '',
		children,
		onMapLoad
	}: Props = $props();

	let container: HTMLDivElement;
	let map = $state<maplibregl.Map | undefined>(undefined);

	setContext(MAP_CONTEXT_KEY, {
		get map() {
			return map;
		}
	});

	onMount(() => {
		const mapOptions: maplibregl.MapOptions = { container, style, renderWorldCopies };
		if (bounds) {
			mapOptions.bounds = bounds;
			mapOptions.fitBoundsOptions = { padding: 20 };
		} else {
			mapOptions.center = center;
			mapOptions.zoom = zoom;
		}
		const m = new maplibregl.Map(mapOptions);

		m.addControl(new maplibregl.NavigationControl(), 'top-left');
		m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

		m.on('load', () => {
			map = m;
			onMapLoad?.(m);
		});

		return () => m.remove();
	});
</script>

<div bind:this={container} class="map-container {className}">
	{#if map}
		{@render children?.()}
	{/if}
</div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
		position: relative;
	}
</style>
