/**
 * thermalView.svelte.ts
 *
 * Shared reactive state for the Thermal Range tab. Searches the *same*
 * 12,039-species index as the Species tab (`sp_options_thermal <- sp_options`
 * in the Shiny app's `serverstart.R` — confirmed, not a smaller subset) but
 * holds a fully independent selection: `speciesSelectThermal` is its own
 * Shiny input, unrelated to `speciesSelect`. No `method` here — the thermal
 * envelope is a single per-species raster, no algorithm choice — and no
 * threshold/uncertainty/occurrence-points, none of which the Thermal tab
 * exposes in the original app.
 */

import type { PeriodCode, ScenarioCode } from '$lib/data/species-catalogue.js';
import {
	loadSpeciesIndex,
	applyFilter,
	isDefaultFilter,
	DEFAULT_FILTER,
	type SpeciesIndexRow,
	type FilterCriteria,
	type SpeciesSelectionView
} from '$lib/data/species-index-loader.js';

class ThermalViewStore implements SpeciesSelectionView {
	// ── Species index — same cached promise as speciesView.init(), no re-fetch ──
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
				console.error('[thermalView] Failed to load species index:', e);
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
	scenario = $state<ScenarioCode>('current');
	period = $state<PeriodCode>('dec50');
	maskVisible = $state(true);
	/** "Split map viewer" — current vs. this scenario/period, side by side (see CompareMap.svelte). Forced off whenever scenario is 'current', mirroring the Shiny app's own `side_select_t` reset. */
	compareMode = $state(false);

	species = $derived(this.selectedTaxonID != null ? (this.index.find((r) => r.taxonID === this.selectedTaxonID) ?? null) : null);

	selectSpecies(taxonID: number) {
		this.selectedTaxonID = taxonID;
		this.scenario = 'current';
		this.compareMode = false;
	}

	setScenario(scenario: ScenarioCode) {
		this.scenario = scenario;
		if (scenario === 'current') this.compareMode = false;
	}
}

export const thermalView = new ThermalViewStore();
