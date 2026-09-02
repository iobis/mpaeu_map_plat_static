<script lang="ts">
	/**
	 * ThermalTab.svelte
	 *
	 * The "THERMAL RANGE" control tab — mirrors quarto_components/_thermal.qmd:
	 * the exact same species search+filter as the Species tab (see
	 * thermalView.svelte.ts for why that's a separate store, not a shared
	 * selection), scenario/period (no model selector — one thermal-envelope
	 * raster per species), and a direct single-file download + code link
	 * (no modal — Shiny's `downloadDataThermal` is a plain `downloadLink`,
	 * unlike the Species tab's multi-file download modal).
	 */
	import { SCENARIO_OPTIONS, PERIOD_OPTIONS, logUrl, thermenvelopeUrl, type ScenarioCode, type PeriodCode } from '$lib/data/species-catalogue.js';
	import { loadSpeciesLog, type SpeciesLog } from '$lib/data/species-metrics-loader.js';
	import { downloadRemoteFile } from '$lib/data/species-download.js';
	import { thermalView } from '$lib/stores/thermalView.svelte.js';
	import SpeciesCombobox from './SpeciesCombobox.svelte';
	import SpeciesFilterModal from './SpeciesFilterModal.svelte';

	thermalView.init();

	let filterModalOpen = $state(false);
	let downloading = $state(false);

	let log = $state<SpeciesLog | null>(null);
	let logLoading = $state(false);

	$effect(() => {
		const sp = thermalView.species;
		if (!sp) {
			log = null;
			return;
		}
		logLoading = true;
		log = null;
		loadSpeciesLog(logUrl(sp.taxonID))
			.then((l) => (log = l))
			.catch((e) => console.error('[ThermalTab] Failed to load species log:', e))
			.finally(() => (logLoading = false));
	});

	async function downloadThermenvelope() {
		const sp = thermalView.species;
		if (!sp || downloading) return;
		downloading = true;
		try {
			await downloadRemoteFile(thermenvelopeUrl(sp.taxonID), `taxonid=${sp.taxonID}_model=mpaeu_what=thermenvelope.tif`);
		} catch (e) {
			console.error('[ThermalTab] Failed to download thermal envelope:', e);
		} finally {
			downloading = false;
		}
	}
</script>

<div class="thermal-tab">
	<div class="search-row">
		<label class="field search-field">
			<span class="field-label">Search species</span>
			{#if thermalView.indexLoading}
				<div class="loading-placeholder">Loading species list…</div>
			{:else if thermalView.indexError}
				<div class="loading-placeholder error">Failed to load the species list.</div>
			{:else}
				<SpeciesCombobox view={thermalView} />
			{/if}
		</label>
		<button
			type="button"
			class="filter-btn"
			class:active={thermalView.filterActive}
			onclick={() => (filterModalOpen = true)}
			title="Filter the species list"
		>
			⏷ Filter
		</button>
	</div>

	{#if thermalView.filterActive}
		<p class="filter-status">
			<span class="dot" aria-hidden="true"></span>
			Filter active — {thermalView.filteredIndex.length} of {thermalView.index.length} species
			<button type="button" class="clear-link" onclick={() => thermalView.clearFilter()}>Clear</button>
		</p>
	{:else if !thermalView.indexLoading && !thermalView.indexError}
		<p class="index-hint">{thermalView.index.length} species available</p>
	{/if}

	<SpeciesFilterModal bind:open={filterModalOpen} view={thermalView} />

	{#if thermalView.species}
		<h2 class="species-title">{thermalView.species.scientificName}</h2>
		<p class="species-subtitle">
			{#if thermalView.species.commonNames.length}
				<span class="common-name">{thermalView.species.commonNames[0]}</span>
			{/if}
			<a class="aphia-link" href="https://obis.org/taxon/{thermalView.species.taxonID}" target="_blank" rel="noopener">
				AphiaID: {thermalView.species.taxonID}
			</a>
		</p>

		<div class="context-info">
			<dl>
				<div class="row">
					<dt>Taxonomy</dt>
					<dd>{thermalView.species.phylum} › {thermalView.species.class} › {thermalView.species.order}</dd>
				</div>
				<div class="row">
					<dt>Number of records</dt>
					<dd>{logLoading ? 'Loading…' : (log?.nFitPoints ?? '—')}</dd>
				</div>
			</dl>
		</div>

		<div class="selectors">
			<label class="field">
				<span class="field-label">Scenario</span>
				<select
					class="ctrl-select"
					value={thermalView.scenario}
					onchange={(e) => thermalView.setScenario(e.currentTarget.value as ScenarioCode)}
				>
					{#each SCENARIO_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>

			{#if thermalView.scenario !== 'current'}
				<label class="field">
					<span class="field-label">Period</span>
					<select
						class="ctrl-select"
						value={thermalView.period}
						onchange={(e) => (thermalView.period = e.currentTarget.value as PeriodCode)}
					>
						{#each PERIOD_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<div class="context-icons">
			<button type="button" class="icon-btn" onclick={downloadThermenvelope} disabled={downloading}>
				<span class="icon" aria-hidden="true">⬇</span> {downloading ? 'Preparing…' : 'Download the data'}
			</button>
			<a class="icon-btn" href="https://github.com/iobis/mpaeu_sdm/blob/main/codes/model_thermal.R" target="_blank" rel="noopener">
				<span class="icon" aria-hidden="true"></span> Access the code
			</a>
		</div>
	{:else}
		<p class="empty-hint">Select a species to see its thermal range.</p>
	{/if}
</div>

<style>
	.thermal-tab {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem 0.9rem;
		overflow-y: auto;
		flex: 1;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.field-label {
		font-size: 0.68rem;
		font-weight: 600;
		color: #475569;
	}
	.ctrl-select {
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.35rem 0.45rem;
		font-size: 0.78rem;
	}

	.search-row {
		display: flex;
		align-items: flex-end;
		gap: 0.4rem;
	}
	.search-field {
		flex: 1;
		min-width: 0;
	}
	.loading-placeholder {
		font-size: 0.72rem;
		color: #94a3b8;
		padding: 0.4rem 0;
	}
	.loading-placeholder.error {
		color: #dc2626;
	}
	.filter-btn {
		flex-shrink: 0;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #475569;
		padding: 0.35rem 0.6rem;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
	}
	.filter-btn:hover {
		background: #e2e8f0;
	}
	.filter-btn.active {
		background: #dbeafe;
		border-color: #006cd7;
		color: #006cd7;
	}

	.filter-status,
	.index-hint {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.66rem;
		color: #64748b;
		margin: 0;
	}
	.filter-status .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #15803d;
		flex-shrink: 0;
	}
	.clear-link {
		background: none;
		border: none;
		color: #006cd7;
		font-size: 0.66rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}

	.species-title {
		font-size: 0.95rem;
		font-style: italic;
		font-weight: 700;
		color: #006cd7;
		margin: 0;
		padding-top: 10px;
	}
	.species-subtitle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.7rem;
		color: #64748b;
		margin: 0.1rem 0 0;
	}
	.common-name {
		text-transform: capitalize;
	}
	.aphia-link {
		color: #006cd7;
		text-decoration: none;
	}
	.aphia-link:hover {
		text-decoration: underline;
	}

	.context-info {
		background: #ffffff;
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		padding: 0.6rem 0.7rem;
	}
	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.7rem;
	}
	.row dt {
		color: #64748b;
	}
	.row dd {
		margin: 0;
		color: #1e293b;
		font-weight: 600;
		text-align: right;
	}

	.selectors {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.2rem;
		border-top: 1px solid #ebebeb;
	}

	.context-icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding-top: 0.6rem;
		border-top: 1px solid #ebebeb;
	}
	.icon-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
		justify-content: center;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 6px;
		color: #475569;
		padding: 0.4rem 0.5rem;
		font-size: 0.66rem;
		font-weight: 600;
		text-decoration: none;
		text-align: center;
		cursor: pointer;
	}
	.icon-btn:hover:not(:disabled) {
		background: #e2e8f0;
	}
	.icon-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.icon-btn .icon {
		font-size: 0.72rem;
	}

	.empty-hint {
		font-size: 0.75rem;
		color: #94a3b8;
	}
</style>
