<script lang="ts">
	/**
	 * SpeciesTab.svelte
	 *
	 * The "SPECIES" control tab — species search, context info box,
	 * model/scenario/period selectors, and the download/code/run-model
	 * actions. Mirrors quarto_components/_species.qmd in the original Shiny
	 * app (the download/code flows are client-side re-implementations —
	 * there's no R backend here — see species-download.ts).
	 */
	import { SCENARIO_OPTIONS, PERIOD_OPTIONS, MODEL_LABELS, logUrl, type ModelMethod, type ScenarioCode, type PeriodCode } from '$lib/data/species-catalogue.js';
	import { loadSpeciesLog, type SpeciesLog } from '$lib/data/species-metrics-loader.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';
	import SpeciesCombobox from './SpeciesCombobox.svelte';
	import SpeciesFilterModal from './SpeciesFilterModal.svelte';
	import ExpertReviewBox from './ExpertReviewBox.svelte';
	import DownloadDataModal from './DownloadDataModal.svelte';
	import DownloadCodeModal from './DownloadCodeModal.svelte';

	speciesView.init();

	let filterModalOpen = $state(false);
	let downloadDataOpen = $state(false);
	let downloadCodeOpen = $state(false);

	let log = $state<SpeciesLog | null>(null);
	let logLoading = $state(false);

	$effect(() => {
		const sp = speciesView.species;
		if (!sp) {
			log = null;
			return;
		}
		logLoading = true;
		log = null;
		loadSpeciesLog(logUrl(sp.taxonID))
			.then((l) => (log = l))
			.catch((e) => console.error('[SpeciesTab] Failed to load species log:', e))
			.finally(() => (logLoading = false));
	});

	$effect(() => {
		void speciesView.method;
		void speciesView.species;
		speciesView.syncThresholds();
	});
</script>

<div class="species-tab">
	<div class="search-row">
		<label class="field search-field">
			<span class="field-label">Search species</span>
			{#if speciesView.indexLoading}
				<div class="loading-placeholder">Loading species list…</div>
			{:else if speciesView.indexError}
				<div class="loading-placeholder error">Failed to load the species list.</div>
			{:else}
				<SpeciesCombobox view={speciesView} />
			{/if}
		</label>
		<button
			type="button"
			class="filter-btn"
			class:active={speciesView.filterActive}
			onclick={() => (filterModalOpen = true)}
			title="Filter the species list"
		>
			⏷ Filter
		</button>
	</div>

	{#if speciesView.filterActive}
		<p class="filter-status">
			<span class="dot" aria-hidden="true"></span>
			Filter active — {speciesView.filteredIndex.length} of {speciesView.index.length} species
			<button type="button" class="clear-link" onclick={() => speciesView.clearFilter()}>Clear</button>
		</p>
	{:else if !speciesView.indexLoading && !speciesView.indexError}
		<p class="index-hint">{speciesView.index.length} species available</p>
	{/if}

	<SpeciesFilterModal bind:open={filterModalOpen} view={speciesView} />

	{#if speciesView.species}
		<div class="species-title-box">
			<h2 class="species-title">{speciesView.species.scientificName}</h2>
			<p class="species-subtitle">
				{#if speciesView.species.commonNames.length}
					<span class="common-name">{speciesView.species.commonNames[0]}</span>
				{/if}
				<a class="aphia-link" href="https://obis.org/taxon/{speciesView.species.taxonID}" target="_blank" rel="noopener">
					AphiaID: {speciesView.species.taxonID}
				</a>
			</p>
		</div>

		<div class="context-info">
			<dl>
				<div class="row"><dt>Group</dt><dd>{speciesView.species.group}</dd></div>
				<div class="row">
					<dt>Taxonomy</dt>
					<dd>{speciesView.species.phylum} › {speciesView.species.class} › {speciesView.species.order}</dd>
				</div>
				{#if logLoading}
					<div class="row"><dt>Details</dt><dd>Loading…</dd></div>
				{:else if log}
					<div class="row">
						<dt>Depth range</dt>
						<dd>
							{#if log.rangeDepthMin != null && log.rangeDepthMax != null}
								{Math.round(log.rangeDepthMin)}–{Math.round(log.rangeDepthMax)} m
							{:else}—{/if}
						</dd>
					</div>
					<div class="row">
						<dt>Occurrence records used to fit</dt>
						<dd>{log.nFitPoints ?? '—'}</dd>
					</div>
					<div class="row"><dt>Model fit date</dt><dd>{log.modelDate ?? '—'}</dd></div>
					<!-- Removing for now -->
					<!-- {#if log.modelGoodMetric}
						<div class="row">
							<dt>Model quality</dt>
							<dd>
								<span class="quality-badge" class:good={log.modelGood}>
									{log.modelGood ? 'Good' : 'Below threshold'}
								</span>
								<span class="quality-detail">
									({log.modelGoodMetric.toUpperCase()} threshold {log.modelGoodThreshold})
								</span>
							</dd>
						</div>
					{/if} -->
				{/if}
			</dl>
		</div>

		<ExpertReviewBox />

		<div class="selectors">
			<label class="field">
				<span class="field-label">Model</span>
				<select
					class="ctrl-select"
					value={speciesView.method ?? ''}
					onchange={(e) => (speciesView.method = e.currentTarget.value as ModelMethod)}
				>
					{#each speciesView.species.availableMethods as m (m)}
						<option value={m}>{MODEL_LABELS[m]}</option>
					{/each}
				</select>
			</label>

			<label class="field">
				<span class="field-label">Scenario</span>
				<select
					class="ctrl-select"
					value={speciesView.scenario}
					onchange={(e) => speciesView.setScenario(e.currentTarget.value as ScenarioCode)}
				>
					{#each SCENARIO_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>

			{#if speciesView.scenario !== 'current'}
				<label class="field">
					<span class="field-label">Period</span>
					<select
						class="ctrl-select"
						value={speciesView.period}
						onchange={(e) => (speciesView.period = e.currentTarget.value as PeriodCode)}
					>
						{#each PERIOD_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<div class="context-icons">
			<button type="button" class="icon-btn" onclick={() => (downloadDataOpen = true)}>
				<span class="icon" aria-hidden="true">⬇</span> Download the data
			</button>
			<a class="icon-btn" href="https://github.com/iobis/mpaeu_sdm/blob/main/codes/model_fit.R" target="_blank" rel="noopener">
				<span class="icon" aria-hidden="true"></span> Access the code
			</a>
			<button type="button" class="icon-btn" onclick={() => (downloadCodeOpen = true)}>
				<span class="icon" aria-hidden="true">▶</span> Run the model
			</button>
		</div>

		<DownloadDataModal bind:open={downloadDataOpen} />
		<DownloadCodeModal bind:open={downloadCodeOpen} />
	{:else}
		<p class="empty-hint">Select a species to see its distribution model.</p>
	{/if}
</div>

<style>
	.species-tab {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem 0.9rem;
		overflow-y: auto;
		flex: 1;
	}

	.species-title-box {
		margin-top: 0.4rem;
		gap: 0.15rem;
		display: flex;
		flex-direction: column;
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
	.quality-badge {
		display: inline-block;
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		font-size: 0.62rem;
		font-weight: 700;
		background: #fee2e2;
		color: #dc2626;
	}
	.quality-badge.good {
		background: #dcfce7;
		color: #15803d;
	}
	.quality-detail {
		font-size: 0.62rem;
		color: #94a3b8;
		font-weight: 400;
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
	.icon-btn:hover {
		background: #e2e8f0;
	}
	.icon-btn .icon {
		font-size: 0.72rem;
	}

	.empty-hint {
		font-size: 0.75rem;
		color: #94a3b8;
	}
</style>
