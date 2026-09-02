<script lang="ts">
	/**
	 * ResultsGrid.svelte
	 *
	 * The 2x2 "contextual results" grid below the map+tabs row — Model
	 * metrics / Response curves / Variable importance / Model explanation.
	 * Mirrors `_modelinfo.qmd`'s 4-cell grid in the Shiny app for the SPECIES
	 * tab specifically (the other tabs reuse the same 4 slots differently
	 * there; out of scope here since only the Species tab is implemented).
	 *
	 * All data is real, loaded client-side from the same public S3 metrics
	 * parquet files the Shiny app reads server-side — nothing here is mocked.
	 *
	 * Every cell is a fixed-height card (see `.cell`/`grid-auto-rows`) with a
	 * scrollable body (`.cell-body`) — deliberately NOT sized to content, so
	 * all 4 cells line up evenly regardless of which one has the most to show
	 * (e.g. a long cvmetrics table next to a much shorter chart).
	 */
	import { metricsUrl } from '$lib/data/species-catalogue.js';
	import {
		loadCvMetrics,
		loadVarImportance,
		loadRespCurves,
		MODEL_EXPLANATIONS,
		type MetricRow,
		type VarImportanceRow,
		type RespCurvePoint
	} from '$lib/data/species-metrics-loader.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';
	import ResponseCurveChart from './ResponseCurveChart.svelte';

	let cvMetrics = $state<MetricRow[]>([]);
	let varImportance = $state<VarImportanceRow[]>([]);
	let respCurves = $state<Map<string, RespCurvePoint[]>>(new Map());
	let selectedVariable = $state<string | null>(null);
	let loading = $state(false);
	let loadError = $state(false);

	$effect(() => {
		const sp = speciesView.species;
		const method = speciesView.method;
		if (!sp || !method) return;

		loading = true;
		loadError = false;
		const key = `${sp.taxonID}:${method}`;

		Promise.all([
			loadCvMetrics(metricsUrl(sp.taxonID, method, 'cvmetrics')),
			loadVarImportance(metricsUrl(sp.taxonID, method, 'varimportance')),
			loadRespCurves(metricsUrl(sp.taxonID, method, 'respcurves'))
		])
			.then(([cv, vi, rc]) => {
				// Guard against a stale response landing after the user already
				// switched species/method again.
				if (`${speciesView.species?.taxonID}:${speciesView.method}` !== key) return;
				cvMetrics = cv;
				varImportance = vi;
				respCurves = rc;
				selectedVariable = vi[0]?.variable ?? null;
			})
			.catch((e) => {
				console.error('[ResultsGrid] Failed to load metrics:', e);
				loadError = true;
			})
			.finally(() => (loading = false));
	});

	const explanation = $derived(speciesView.method ? MODEL_EXPLANATIONS[speciesView.method] : null);
	const curvePoints = $derived(selectedVariable ? (respCurves.get(selectedVariable) ?? []) : []);
</script>

{#if !speciesView.species}
	<div class="empty-grid">
		<p>Select a species to start.</p>
	</div>
{:else}
	<div class="results-grid">
		<section class="cell">
			<h3>Model metrics</h3>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else if loadError}
				<p class="hint error">Failed to load model metrics.</p>
			{:else}
				<div class="cell-body">
					<table>
						<thead>
							<tr><th>Metric</th><th>Threshold</th><th>Mean of 5 folds</th><th>SD</th></tr>
						</thead>
						<tbody>
							{#each cvMetrics as row (row.metric + row.threshold)}
								<tr>
									<td>{row.metric}</td>
									<td>{row.threshold || '—'}</td>
									<td>{row.mean.toFixed(3)}</td>
									<td>{row.sd.toFixed(3)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<section class="cell">
			<h3>Response curves</h3>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else if varImportance.length}
				<label class="var-select">
					<span>Variable</span>
					<select bind:value={selectedVariable}>
						{#each varImportance as v (v.variable)}
							<option value={v.variable}>{v.label}</option>
						{/each}
					</select>
				</label>
				<div class="cell-body chart-body">
					{#if curvePoints.length}
						<ResponseCurveChart points={curvePoints} />
					{/if}
				</div>
			{/if}
		</section>

		<section class="cell">
			<h3>Variable importance</h3>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else}
				<div class="cell-body">
					<table>
						<thead>
							<tr><th>Variable</th><th>Mean</th><th>SD</th></tr>
						</thead>
						<tbody>
							{#each varImportance as row (row.variable)}
								<tr>
									<td>{row.label}</td>
									<td>{row.mean.toFixed(3)}</td>
									<td>{row.sd.toFixed(3)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<section class="cell">
			<h3>Model explanation</h3>
			{#if explanation}
				<div class="cell-body">
					<p class="body-text">{explanation}</p>
				</div>
			{/if}
		</section>
	</div>
{/if}

<style>
	.empty-grid {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		background: #ffffff;
		border: 1px dashed #d4d4d4;
		border-radius: 10px;
	}
	.empty-grid p {
		font-size: 0.8rem;
		color: #94a3b8;
		margin: 0;
	}

	.results-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-auto-rows: 320px;
		gap: 0.75rem;
	}
	@media (max-width: 900px) {
		.results-grid {
			grid-template-columns: 1fr;
		}
	}

	.cell {
		background: #ffffff;
		border: 1px solid #d8d8d8;
		border-radius: 10px;
		padding: 0.75rem 0.9rem;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.cell h3 {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: #006cd7;
		flex-shrink: 0;
	}

	.hint {
		font-size: 0.72rem;
		color: #94a3b8;
		margin: 0;
	}
	.hint.error {
		color: #dc2626;
	}

	/* Shared scrollable body — every cell type uses this so all 4 cards end
	   up the same height regardless of how much content each one has. */
	.cell-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.chart-body {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
	}
	th {
		position: sticky;
		top: 0;
		background: #f0f4f8;
		text-align: left;
		padding: 0.3rem 0.4rem;
		color: #475569;
		font-weight: 600;
	}
	td {
		padding: 0.28rem 0.4rem;
		border-top: 1px solid #ebebeb;
		color: #1e293b;
	}

	.var-select {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		color: #475569;
		margin-bottom: 0.4rem;
		flex-shrink: 0;
	}
	.var-select select {
		flex: 1;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.25rem 0.35rem;
		font-size: 0.72rem;
	}

	.body-text {
		font-size: 0.75rem;
		color: #334155;
		line-height: 1.55;
		margin: 0;
	}
</style>
