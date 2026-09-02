/**
 * vector-layer-builder.ts
 *
 * Builds deck.gl layers for GeoJSON vector data (polygons, lines, points).
 * Used by DeckOverlay to render all layer types in a single MapboxOverlay,
 * ensuring correct z-ordering with COG raster layers.
 */

import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { FeatureCollection, Feature } from 'geojson';

export interface VectorLayerProps {
	id: string;
	url: string;
	/** geometry family derived from LayerConfig.type */
	geomKind: 'geojson-polygon' | 'geojson-line' | 'geojson-point';
	opacity: number;
	visible: boolean;
	/** Feature property used for categorical colouring */
	categoryField?: string;
	/** value → hex colour for categorical layers */
	colorMap?: Record<string, string>;
	/** Flat fill colour for non-categorical layers (no `categoryField`/`colorMap`) — skips the generic blue `DEFAULT_FILL`. */
	fillColor?: string;
	/** Hex line/stroke colour. @default a dark neutral grey */
	lineColor?: string;
	/**
	 * Independent fill/line opacity multipliers (each 0-1, applied on top of
	 * `opacity`) — for boundary-style layers (e.g. Realms/EEZ) where the fill
	 * is meant to read as near-invisible while the outline stays clearly
	 * visible, which a single shared `opacity` can't express (the Shiny app's
	 * own Realms/EEZ styling uses `fillOpacity: 0.05` vs `opacity: 0.3`, a much
	 * bigger gap than this builder's normal fixed 2:1 fill:line ratio).
	 * @default 1 for fill, 0.5 for line — matches this builder's original
	 * fixed behaviour (line always half as opaque as fill) when omitted.
	 */
	fillOpacityFactor?: number;
	lineOpacityFactor?: number;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16)
	];
}

const DEFAULT_FILL: [number, number, number] = [100, 160, 200];
const DEFAULT_FALLBACK: [number, number, number] = [170, 170, 170];

// Tableau-10 + extras — 20 perceptually distinct colours
const PALETTE = [
	'#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
	'#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
	'#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896',
	'#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d'
];

// ── Auto-detection helpers ─────────────────────────────────────────────────────

/** Return the name of the first feature property, or undefined if no features. */
export function detectFirstField(data: FeatureCollection): string | undefined {
	const props = data.features[0]?.properties;
	return props ? Object.keys(props)[0] : undefined;
}

/** Build a colour map from all unique values of `field` across features. */
export function buildAutoColorMap(
	data: FeatureCollection,
	field: string
): Record<string, string> {
	const values = new Set<string>();
	for (const f of data.features) {
		const v = f.properties?.[field];
		if (v != null) values.add(String(v));
	}
	const map: Record<string, string> = {};
	[...values].sort().forEach((v, i) => { map[v] = PALETTE[i % PALETTE.length]; });
	return map;
}

/**
 * Resolve the effective {field, colorMap} for a vector layer.
 * Uses explicit config when the colorMap keys actually match data values;
 * otherwise auto-generates from the unique values found in the field.
 * Exported so DeckOverlay can call it and surface resolved colours to the store.
 */
export function resolveColors(
	props: VectorLayerProps,
	data: FeatureCollection
): { field: string; colorMap: Record<string, string> } | null {
	const field = props.categoryField ?? detectFirstField(data);
	if (!field) return null;

	if (props.colorMap && Object.keys(props.colorMap).length > 0) {
		// Check whether the explicit map actually matches any feature values
		const hasMatch = data.features.slice(0, 30).some(
			(f) => String(f.properties?.[field] ?? '') in props.colorMap!
		);
		if (hasMatch) return { field, colorMap: props.colorMap };
	}

	// Explicit map doesn't match data (or wasn't provided) — auto-generate
	return { field, colorMap: buildAutoColorMap(data, field) };
}

// ── Layer builders ─────────────────────────────────────────────────────────────

export function buildVectorLayer(
	props: VectorLayerProps,
	data: FeatureCollection
): GeoJsonLayer | ScatterplotLayer {
	const { id, visible, opacity, geomKind, fillColor, lineColor, fillOpacityFactor = 1, lineOpacityFactor = 0.5 } = props;
	const fillAlpha = Math.round(opacity * fillOpacityFactor * 255);
	const lineAlpha = Math.round(opacity * lineOpacityFactor * 255);

	const resolved = resolveColors(props, data);
	const flatFill = fillColor ? hexToRgb(fillColor) : DEFAULT_FILL;
	const lineRgb = lineColor ? hexToRgb(lineColor) : [30, 30, 30];

	const getFillColor = resolved
		? (f: Feature): [number, number, number, number] => {
				const val = String(f.properties?.[resolved.field] ?? '');
				const hex = resolved.colorMap[val];
				return hex ? [...hexToRgb(hex), fillAlpha] : [...DEFAULT_FALLBACK, fillAlpha];
		  }
		: (): [number, number, number, number] => [...flatFill, fillAlpha];

	if (geomKind === 'geojson-point') {
		return new ScatterplotLayer({
			id,
			data: data.features as Feature[],
			visible,
			getPosition: (f: Feature) => {
				const geom = f.geometry;
				if (geom.type === 'Point') return geom.coordinates as [number, number];
				return [0, 0];
			},
			getFillColor: (f: Feature) => getFillColor(f),
			getRadius: 4,
			radiusMinPixels: 2,
			radiusMaxPixels: 12,
			pickable: true,
			opacity: 1
		} as any);
	}

	// polygon or line
	return new GeoJsonLayer({
		id,
		data,
		visible,
		opacity: 1,
		filled: geomKind !== 'geojson-line',
		stroked: true,
		getFillColor: (f: Feature) => getFillColor(f) as any,
		getLineColor: [...lineRgb, lineAlpha] as any,
		getLineWidth: 1,
		lineWidthMinPixels: 0.5,
		lineWidthMaxPixels: 2,
		pickable: true,
		autoHighlight: true,
		highlightColor: [255, 255, 255, 60],
		updateTriggers: {
			getFillColor: [props.colorMap, props.categoryField, opacity, fillColor, fillOpacityFactor],
			getLineColor: [opacity, lineColor, lineOpacityFactor]
		}
	} as any);
}
