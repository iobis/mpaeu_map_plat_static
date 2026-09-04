/**
 * point-table-loader.ts
 *
 * Reads flat X/Y point data (Parquet — the format the production STAC catalog
 * actually uses for occurrence records, e.g. `what=fitocc.parquet`) directly
 * into a row array a deck.gl ScatterplotLayer can consume via `getPosition`,
 * with no intermediate GeoJSON FeatureCollection.
 *
 * Uses hyparquet: pure JS, no WASM (consistent with this project's other
 * client-side format readers — geotiff.js, flatgeobuf — none of which need a
 * WASM runtime). Fetches each file's full bytes (via parquet-fetch.ts) rather
 * than hyparquet's own HTTP range-based reader, which breaks under GitHub
 * Pages' gzip-compressing CDN (see that file) — an acceptable trade for these
 * tiny per-species occurrence files (tens to low hundreds of rows).
 *
 * For row counts in the thousands this plain row-object shape is fine; a much
 * larger occurrence dataset would be better served by hyparquet's columnar
 * `parquetRead` (onChunk) API feeding a deck.gl binary data shape directly —
 * not needed for the current dataset sizes.
 */

import { parquetReadObjects } from 'hyparquet';
import { fetchParquetBuffer } from '$lib/data/parquet-fetch.js';
import { ScatterplotLayer } from '@deck.gl/layers';

export interface PointTableRow {
	lon: number;
	lat: number;
	[key: string]: unknown;
}

export interface PointTableOptions {
	lonField: string;
	latField: string;
	/** Extra columns to keep on each row (e.g. for tooltips). Default: all columns. */
	columns?: string[];
}

export async function loadPointTable(url: string, opts: PointTableOptions): Promise<PointTableRow[]> {
	const file = await fetchParquetBuffer(url);
	const columns = opts.columns ?? undefined; // undefined = read all columns
	const rows = await parquetReadObjects({ file, columns });

	const out: PointTableRow[] = [];
	for (const row of rows) {
		const lon = Number(row[opts.lonField]);
		const lat = Number(row[opts.latField]);
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
		out.push({ ...row, lon, lat } as PointTableRow);
	}
	return out;
}

export interface TablePointLayerProps {
	id: string;
	opacity: number;
	visible: boolean;
	/** Fixed fill colour, hex. @default '#111827' (matches the simple dark occurrence-point styling in the current Shiny app) */
	color?: string;
}

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.replace('#', ''), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildTablePointLayer(props: TablePointLayerProps, rows: PointTableRow[]): ScatterplotLayer {
	const { id, opacity, visible, color = '#111827' } = props;
	const rgb = hexToRgb(color);
	const alpha = Math.round(opacity * 255);
	return new ScatterplotLayer({
		id,
		data: rows,
		visible,
		getPosition: (d: PointTableRow) => [d.lon, d.lat],
		getFillColor: [...rgb, alpha],
		getRadius: 4,
		radiusMinPixels: 2,
		radiusMaxPixels: 12,
		pickable: true,
		opacity: 1
	});
}
