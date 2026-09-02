/**
 * speciesView.svelte.ts
 *
 * Shared reactive state for the Species tab. Unlike the generic
 * `activeLayers` store (Phase 1 demo, arbitrary layer stack), the Species
 * tab shows exactly one species' prediction at a time — no stacking, no
 * z-order — so this is a flat "current selection" object, not a list.
 *
 * Also owns the full species index (all 12,039 species with model output)
 * and the filter-modal criteria, since both the search combobox and the map
 * shell need them.
 */

import type { ModelMethod, PeriodCode, ScenarioCode, ThresholdMode } from '$lib/data/species-catalogue.js';
import { thresholdsUrl } from '$lib/data/species-catalogue.js';
import { loadThresholds, type ThresholdsRow } from '$lib/data/species-metrics-loader.js';
import {
	loadSpeciesIndex,
	applyFilter,
	isDefaultFilter,
	DEFAULT_FILTER,
	type SpeciesIndexRow,
	type FilterCriteria
} from '$lib/data/species-index-loader.js';

class SpeciesViewStore {
	// ── Species index (loaded once) ───────────────────────────────────────────
	index = $state<SpeciesIndexRow[]>([]);
	indexLoading = $state(true);
	indexError = $state(false);
	private indexInitStarted = false;

	init() {
		if (this.indexInitStarted) return;
		this.indexInitStarted = true;
		loadSpeciesIndex()
			.then((rows) => (this.index = rows))
			.catch((e) => {
				console.error('[speciesView] Failed to load species index:', e);
				this.indexError = true;
			})
			.finally(() => (this.indexLoading = false));
	}

	// ── Filter modal ───────────────────────────────────────────────────────────
	filter = $state<FilterCriteria>({ ...DEFAULT_FILTER });
	filterActive = $derived(!isDefaultFilter(this.filter));
	filteredIndex = $derived(this.filterActive ? applyFilter(this.index, this.filter) : this.index);

	setFilter(f: FilterCriteria) {
		this.filter = f;
	}
	clearFilter() {
		this.filter = { ...DEFAULT_FILTER };
	}

	// ── Current selection ──────────────────────────────────────────────────────
	selectedTaxonID = $state<number | null>(null);
	method = $state<ModelMethod | null>(null);
	scenario = $state<ScenarioCode>('current');
	period = $state<PeriodCode>('dec50');
	/** "Split map viewer" — current vs. this scenario/period, side by side (see CompareMap.svelte). Forced off whenever scenario is 'current', mirroring the Shiny app's own `side_select` reset. */
	compareMode = $state(false);

	maskVisible = $state(true);
	maskBandIndex = $state(2); // "Fit region" — matches layers.ts's maskDefaultBandIndex
	thresholdMode = $state<ThresholdMode>('none');
	showUncertainty = $state(false);
	showOccurrencePoints = $state(true);

	species = $derived(this.selectedTaxonID != null ? (this.index.find((r) => r.taxonID === this.selectedTaxonID) ?? null) : null);

	// ── Thresholds — loaded once per species+method, shared by the raster
	// render (as a rescale-domain floor) and the Extra Controls hint text. ──
	thresholds = $state<ThresholdsRow | null>(null);
	private thresholdsKey = '';

	async syncThresholds() {
		const sp = this.species;
		const method = this.method;
		if (!sp || !method) {
			this.thresholds = null;
			return;
		}
		const key = `${sp.taxonID}:${method}`;
		if (key === this.thresholdsKey) return;
		this.thresholdsKey = key;
		try {
			this.thresholds = await loadThresholds(thresholdsUrl(sp.taxonID), method);
		} catch (e) {
			console.error('[speciesView] Failed to load thresholds:', e);
			this.thresholds = null;
		}
	}

	selectSpecies(taxonID: number) {
		this.selectedTaxonID = taxonID;
		const row = this.index.find((r) => r.taxonID === taxonID);
		this.method = row?.availableMethods[0] ?? null;
		this.scenario = 'current';
		this.compareMode = false;
		this.thresholdMode = 'none';
		this.showUncertainty = false;
	}

	setScenario(scenario: ScenarioCode) {
		this.scenario = scenario;
		if (scenario === 'current') this.compareMode = false;
	}
}

export const speciesView = new SpeciesViewStore();
