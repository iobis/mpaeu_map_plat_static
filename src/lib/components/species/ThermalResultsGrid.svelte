<script lang="ts">
	/**
	 * ThermalResultsGrid.svelte
	 *
	 * The Thermal Range tab's 2x2 contextual grid — mirrors the thermal
	 * branch of `components/contextualinfo.R`/`_modelinfo.qmd`'s 4-cell
	 * layout: the quantile/mean/sd table ("tableA"), the SST density plot
	 * ("plotA" — approximated here, see ThermalDensityChart.svelte), the
	 * area-within-range table ("tableB"), and the fixed explanatory text.
	 */
	import { thermMetricsUrl } from '$lib/data/species-catalogue.js';
	import { loadThermMetrics, scenarioLabel, periodLabel, type ThermMetrics } from '$lib/data/thermal-metrics-loader.js';
	import { thermalView } from '$lib/stores/thermalView.svelte.js';
	import ThermalDensityChart from './ThermalDensityChart.svelte';

	let metrics = $state<ThermMetrics | null>(null);
	let loading = $state(false);
	let loadError = $state(false);
	let key = '';

	$effect(() => {
		const sp = thermalView.species;
		if (!sp) return;
		if (key === String(sp.taxonID)) return;
		key = String(sp.taxonID);
		loading = true;
		loadError = false;
		metrics = null;
		loadThermMetrics(thermMetricsUrl(sp.taxonID))
			.then((m) => (metrics = m))
			.catch((e) => {
				console.error('[ThermalResultsGrid] Failed to load thermal metrics:', e);
				loadError = true;
			})
			.finally(() => (loading = false));
	});
</script>

{#if !thermalView.species}
	<div class="empty-grid">
		<p>Select a species to start.</p>
	</div>
{:else}
	<div class="results-grid">
		<section class="cell">
			<h3>Thermal range</h3>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else if loadError}
				<p class="hint error">Failed to load thermal metrics.</p>
			{:else if metrics}
				<div class="cell-body">
					<div class="table-wrap">
						<table>
							<thead>
								<tr><th>Scenario</th><th>Decade</th><th>Q5%</th><th>Q50%</th><th>Q95%</th><th>Mean</th><th>SD</th></tr>
							</thead>
							<tbody>
								{#each metrics.limits as row (row.scenario + (row.period ?? ''))}
									<tr>
										<td>{scenarioLabel(row.scenario)}</td>
										<td>{periodLabel(row.period)}</td>
										<td>{row.q05.toFixed(1)}</td>
										<td>{row.q50.toFixed(1)}</td>
										<td>{row.q95.toFixed(1)}</td>
										<td>{row.mean.toFixed(1)}</td>
										<td>{row.sd.toFixed(1)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</section>

		<section class="cell">
			<h3>Thermal range (density)</h3>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else if metrics}
				<div class="cell-body chart-body">
					<ThermalDensityChart limits={metrics.limits} />
				</div>
			{/if}
		</section>

		<section class="cell">
			<h3>Area within thermal range</h3>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else if metrics}
				<div class="cell-body">
					<div class="table-wrap">
						<table>
							<thead>
								<tr><th>Scenario</th><th>Decade</th><th>Area (km²)</th></tr>
							</thead>
							<tbody>
								{#each metrics.areas as row (row.scenario + (row.period ?? ''))}
									<tr>
										<td>{scenarioLabel(row.scenario)}</td>
										<td>{periodLabel(row.period)}</td>
										<td>{Math.round(row.areaKm2).toLocaleString()}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</section>

		<section class="cell">
			<h3>How this data is extracted?</h3>
			<div class="cell-body">
				<p class="body-text">
					Thermal ranges are extracted based on the occurrence data and SST data from <a href="https://www.bio-oracle.org/" target="_blank" rel="noopener"
						>Bio-ORACLE v3.0</a
					>. For each occurrence record we extract the temperature and then calculate a kernel density. This follows the method developed in the
					<a href="https://github.com/iobis/speedy" target="_blank" rel="noopener">'speedy' package</a>.
				</p>
			</div>
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

	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.68rem;
	}
	th {
		position: sticky;
		top: 0;
		background: #f0f4f8;
		text-align: left;
		padding: 0.3rem 0.4rem;
		color: #475569;
		font-weight: 600;
		white-space: nowrap;
	}
	td {
		padding: 0.28rem 0.4rem;
		border-top: 1px solid #ebebeb;
		color: #1e293b;
		white-space: nowrap;
	}

	.body-text {
		font-size: 0.75rem;
		color: #334155;
		line-height: 1.55;
		margin: 0;
	}
	.body-text a {
		color: #006cd7;
	}
</style>
