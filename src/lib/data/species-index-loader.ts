/**
 * species-index-loader.ts
 *
 * Loads the full list of species that have model output (12,039 rows, ~1MB)
 * from a static asset — `static/data/species-index.parquet`, built by
 * `scripts/build-species-index.R` from the same two files the Shiny app
 * reads at server start (mpaeu_map_platform's `data/app_splist.rds` +
 * `data/species_db.parquet`, see components/serverstart.R). No backend
 * involved: fetched once, parsed with hyparquet, then held in memory —
 * search and the filter modal both do a plain linear scan over the parsed
 * array (12k short-string comparisons is sub-5ms in practice, confirmed
 * while building this; no fuzzy-search library needed at this scale).
 */

import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet';
import { base } from '$app/paths';
import type { ModelMethod } from './species-catalogue.js';

export interface SpeciesIndexRow {
	taxonID: number;
	scientificName: string;
	commonNames: string[];
	group: string;
	regionNames: string[];
	phylum: string;
	class: string;
	order: string;
	family: string;
	redlistCategory: string;
	study: string;
	/** Ordered by priority (ensemble > maxent > rf > xgboost > esm) — index 0 is the "best available" default. */
	availableMethods: ModelMethod[];
	/** Precomputed lowercase scientificName + common names, for fast search. */
	searchText: string;
}

function splitList(s: string | null | undefined): string[] {
	if (!s || s === 'not_available') return [];
	return s
		.split('; ')
		.map((x) => x.trim())
		.filter(Boolean);
}

function toIndexRow(r: Record<string, unknown>): SpeciesIndexRow {
	const commonNames = splitList(r.commonNames as string);
	const availableMethods = ((r.availableMethods as string) ?? '').split(',').filter(Boolean) as ModelMethod[];
	return {
		taxonID: r.taxonID as number,
		scientificName: r.scientificName as string,
		commonNames,
		group: r.group as string,
		regionNames: splitList(r.regionName as string),
		phylum: r.phylum as string,
		class: r.class as string,
		order: r.order as string,
		family: r.family as string,
		redlistCategory: r.redlistCategory as string,
		study: r.study as string,
		availableMethods,
		searchText: [r.scientificName as string, ...commonNames].join(' ').toLowerCase()
	};
}

let cache: Promise<SpeciesIndexRow[]> | null = null;

export function loadSpeciesIndex(): Promise<SpeciesIndexRow[]> {
	if (!cache) {
		cache = (async () => {
			const file = await asyncBufferFromUrl({ url: `${base}/data/species-index.parquet` });
			const rows = await parquetReadObjects({ file });
			return rows.map(toIndexRow);
		})();
	}
	return cache;
}

// ── Search ─────────────────────────────────────────────────────────────────────
// Ranked: scientific name starts-with > scientific name contains >
// common name starts-with > common name contains.

export function searchSpecies(rows: SpeciesIndexRow[], query: string, limit = 40): SpeciesIndexRow[] {
	const q = query.trim().toLowerCase();
	if (!q) return rows.slice(0, limit);

	const scored: { row: SpeciesIndexRow; score: number }[] = [];
	for (const row of rows) {
		const sci = row.scientificName.toLowerCase();
		let score = -1;
		if (sci.startsWith(q)) score = 0;
		else if (sci.includes(q)) score = 1;
		else {
			for (const cn of row.commonNames) {
				const cnLower = cn.toLowerCase();
				if (cnLower.startsWith(q)) {
					score = 2;
					break;
				}
				if (cnLower.includes(q)) {
					score = 3;
					break;
				}
			}
		}
		if (score >= 0) scored.push({ row, score });
	}
	scored.sort((a, b) => a.score - b.score || a.row.scientificName.localeCompare(b.row.scientificName));
	return scored.slice(0, limit).map((s) => s.row);
}

// ── Filter (mirrors scripts/filter_functions.R's filter_opts()) ────────────────

export interface FilterCriteria {
	group: string;
	commonName: string;
	region: string;
	phylum: string;
	class: string;
	order: string;
	family: string;
	includeOtherProjects: boolean;
}

export const DEFAULT_FILTER: FilterCriteria = {
	group: 'all',
	commonName: 'all',
	region: 'all',
	phylum: 'all',
	class: 'all',
	order: 'all',
	family: 'all',
	includeOtherProjects: false
};

export function isDefaultFilter(f: FilterCriteria): boolean {
	return (Object.keys(DEFAULT_FILTER) as (keyof FilterCriteria)[]).every((k) => f[k] === DEFAULT_FILTER[k]);
}

/**
 * The subset of a species-selection store (`speciesView`, `thermalView`,
 * …) that `SpeciesCombobox.svelte`/`SpeciesFilterModal.svelte` need. The
 * Shiny app's `speciesSelectThermal` searches the exact same species list
 * as `speciesSelect` (`sp_options_thermal <- sp_options`, see
 * `serverstart.R`) but is a fully independent selection — so rather than
 * duplicate the combobox/filter-modal UI (keyboard nav, faceted filters)
 * per tab, those two components take the store as a `view` prop typed
 * against this interface instead of importing the `speciesView` singleton
 * directly.
 */
export interface SpeciesSelectionView {
	readonly index: SpeciesIndexRow[];
	readonly filteredIndex: SpeciesIndexRow[];
	readonly filterActive: boolean;
	readonly filter: FilterCriteria;
	readonly species: SpeciesIndexRow | null;
	selectSpecies(taxonID: number): void;
	setFilter(f: FilterCriteria): void;
	clearFilter(): void;
}

type ExactFacet = 'group' | 'phylum' | 'class' | 'order' | 'family';
type ListFacet = 'commonName' | 'region';
type Facet = ExactFacet | ListFacet | 'includeOtherProjects';

/** Applies every criterion in `f` except `exclude` — used both for the final result and for computing each dropdown's own reachable choices. */
export function applyFilter(rows: SpeciesIndexRow[], f: FilterCriteria, exclude?: Facet): SpeciesIndexRow[] {
	return rows.filter((r) => {
		if (exclude !== 'includeOtherProjects' && !f.includeOtherProjects && r.study !== 'mpaeurope') return false;
		if (exclude !== 'group' && f.group !== 'all' && r.group !== f.group) return false;
		if (exclude !== 'commonName' && f.commonName !== 'all' && !r.commonNames.includes(f.commonName)) return false;
		if (exclude !== 'region' && f.region !== 'all' && !r.regionNames.includes(f.region)) return false;
		if (exclude !== 'phylum' && f.phylum !== 'all' && r.phylum !== f.phylum) return false;
		if (exclude !== 'class' && f.class !== 'all' && r.class !== f.class) return false;
		if (exclude !== 'order' && f.order !== 'all' && r.order !== f.order) return false;
		if (exclude !== 'family' && f.family !== 'all' && r.family !== f.family) return false;
		return true;
	});
}

export function facetOptions(rows: SpeciesIndexRow[], f: FilterCriteria, facet: ExactFacet): string[] {
	const subset = applyFilter(rows, f, facet);
	return [...new Set(subset.map((r) => r[facet]).filter(Boolean))].sort();
}

export function facetListOptions(rows: SpeciesIndexRow[], f: FilterCriteria, facet: ListFacet): string[] {
	const subset = applyFilter(rows, f, facet);
	const key = facet === 'commonName' ? 'commonNames' : 'regionNames';
	const set = new Set<string>();
	for (const r of subset) for (const v of r[key]) set.add(v);
	return [...set].sort();
}
