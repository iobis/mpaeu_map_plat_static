<script lang="ts">
	/**
	 * AdditionalDetails.svelte
	 *
	 * The "Show additional details" expander — mirrors the extra-info section
	 * in `_modelinfo.qmd`/`components/extrainfo.R` in the Shiny app: a spatial
	 * bias K/L-function pair, SHAPE/MESS extrapolation-diagnostic map
	 * previews for a chosen scenario/period, and a raw model-details JSON
	 * viewer. Species-tab only, and gated behind a toggle so its (real, not
	 * mocked) but heavier data — the bias charts in particular need webR,
	 * loaded lazily — never loads unless asked for.
	 */
	import { biasMetricsUrl, shapeUrl, messUrl, logUrl, SCENARIO_PERIOD_COMBOS } from '$lib/data/species-catalogue.js';
	import { loadBiasEnvelopes, type BiasEnvelopes } from '$lib/data/webr-bias-loader.js';
	import { unboxRJson } from '$lib/data/species-metrics-loader.js';
	import { titilerPreviewUrl, fetchTitilerBandStats } from '$lib/components/maplibre/index.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';
	import EnvelopeChart from './EnvelopeChart.svelte';
	import JsonViewer from './JsonViewer.svelte';
	import { PUBLIC_TITILER_URL } from '$env/static/public';
	import { base } from '$app/paths';

	let open = $state(false);

	// ── K/L spatial-bias envelopes (webR) ─────────────────────────────────────
	let bias = $state<BiasEnvelopes | null>(null);
	let biasLoading = $state(false);
	let biasError = $state(false);
	let biasKey = '';

	$effect(() => {
		const sp = speciesView.species;
		if (!open || !sp) return;
		if (biasKey === String(sp.taxonID)) return;
		biasKey = String(sp.taxonID);
		bias = null;
		biasLoading = true;
		biasError = false;
		loadBiasEnvelopes(biasMetricsUrl(sp.taxonID))
			.then((b) => (bias = b))
			.catch((e) => {
				console.error('[AdditionalDetails] Failed to load bias envelopes:', e);
				biasError = true;
			})
			.finally(() => (biasLoading = false));
	});

	// ── Model details JSON (raw log.json + the field-explanation file) ───────
	let rawLog = $state<unknown>(null);
	let explanation = $state<unknown>(null);
	let jsonLoading = $state(false);
	let jsonKey = '';

	$effect(() => {
		const sp = speciesView.species;
		if (!open || !sp) return;
		if (jsonKey === String(sp.taxonID)) return;
		jsonKey = String(sp.taxonID);
		jsonLoading = true;
		Promise.all([
			fetch(logUrl(sp.taxonID)).then((r) => r.json()),
			explanation ? Promise.resolve(explanation) : fetch(`${base}/data/log_explanation.json`).then((r) => r.json())
		])
			.then(([log, exp]) => {
				rawLog = unboxRJson(log);
				explanation = unboxRJson(exp);
			})
			.catch((e) => console.error('[AdditionalDetails] Failed to load model-details JSON:', e))
			.finally(() => (jsonLoading = false));
	});

	// ── SHAPE / MESS extrapolation previews ───────────────────────────────────
	let selectedCombo = $state(SCENARIO_PERIOD_COMBOS[0].value);
	const combo = $derived(SCENARIO_PERIOD_COMBOS.find((c) => c.value === selectedCombo) ?? SCENARIO_PERIOD_COMBOS[0]);

	let shapeStats = $state<{ min: number; max: number } | null>(null);
	let shapeStatsKey = '';

	$effect(() => {
		const sp = speciesView.species;
		if (!open || !sp) return;
		const key = `${sp.taxonID}:${combo.bandIndex}`;
		if (shapeStatsKey === key) return;
		shapeStatsKey = key;
		shapeStats = null;
		fetchTitilerBandStats(PUBLIC_TITILER_URL, shapeUrl(sp.taxonID), combo.bandIndex)
			.then((s) => (shapeStats = s))
			.catch((e) => console.error('[AdditionalDetails] Failed to load SHAPE statistics:', e));
	});

	// Shiny's cl_mess palette — 8 qualitative colours, one per possible extrapolating-variable count.
	const MESS_COLORS: [number, number, number][] = [
		[27, 158, 119],
		[217, 95, 2],
		[117, 112, 179],
		[231, 41, 138],
		[102, 166, 30],
		[230, 171, 2],
		[166, 118, 29],
		[102, 102, 102]
	];

	const shapePreviewUrl = $derived.by(() => {
		const sp = speciesView.species;
		if (!sp || !shapeStats) return null;
		return titilerPreviewUrl(PUBLIC_TITILER_URL, shapeUrl(sp.taxonID), {
			bandIndex1Based: combo.bandIndex,
			rescale: [shapeStats.min, shapeStats.max],
			colormapName: 'viridis'
		});
	});

	const messPreviewUrl = $derived.by(() => {
		const sp = speciesView.species;
		if (!sp) return null;
		const colormap: Record<number, [number, number, number, number]> = {};
		MESS_COLORS.forEach((rgb, i) => (colormap[i] = [...rgb, 255]));
		return titilerPreviewUrl(PUBLIC_TITILER_URL, messUrl(sp.taxonID), {
			bandIndex1Based: combo.bandIndex,
			colormap
		});
	});
</script>

{#if speciesView.species}
<div class="additional-details">
	<div class="toolbar-row">
		<button type="button" class="toggle-btn" onclick={() => (open = !open)}>
			{open ? 'Hide additional details' : 'Show additional details'}
		</button>
		{#if speciesView.method}
			<a
				class="report-btn"
				href="{base}/report/?taxonid={speciesView.species.taxonID}&method={speciesView.method}"
				target="_blank"
				rel="noopener"
			>
				Generate report
			</a>
		{/if}
	</div>

	{#if open}
		<div class="details-grid">
			<section class="cell bias-cell">
				<h3>Spatial bias — K/L function</h3>
				{#if biasLoading}
					<p class="hint">Loading R runtime and bias data… (first time only, ~10&nbsp;MB)</p>
				{:else if biasError}
					<p class="hint error">Failed to load the spatial-bias data.</p>
				{:else if bias}
					<EnvelopeChart points={bias.k} title="K-function" />
					<EnvelopeChart points={bias.l} title="L-function" />
				{/if}
				<p class="explain">
					The K-function is a tool that can be used to assess the dependence between locations at different distances. The L-function
					transforms the K-function to a straight line and makes interpretation easier. Both tools can be used to assess the clustering of
					the points. To know more, <a href="https://www.paulamoraga.com/book-spatial/the-k-function.html#the-k-function" target="_blank" rel="noopener"
						>read this article</a
					>.
				</p>
			</section>

			<section class="cell extrapolation-cell">
				<h3>Extrapolation — SHAPE &amp; MESS</h3>
				<label class="combo-select">
					<span>Scenario and period</span>
					<select bind:value={selectedCombo}>
						{#each SCENARIO_PERIOD_COMBOS as c (c.value)}
							<option value={c.value}>{c.label}</option>
						{/each}
					</select>
				</label>
				<div class="preview-row">
					<figure>
						<figcaption>SHAPE</figcaption>
						{#if shapePreviewUrl}
							<img src={shapePreviewUrl} alt="SHAPE extrapolation statistic for {combo.label}" />
						{:else}
							<div class="preview-placeholder">Loading…</div>
						{/if}
					</figure>
					<figure>
						<figcaption>MESS</figcaption>
						{#if messPreviewUrl}
							<img src={messPreviewUrl} alt="MESS extrapolation statistic for {combo.label}" />
						{:else}
							<div class="preview-placeholder">Loading…</div>
						{/if}
					</figure>
				</div>
				<p class="explain">
					SHAPE is a method of estimating model extrapolation. The higher the value of the SHAPE statistic, the higher the extrapolation at
					that particular area. To know more, <a href="https://doi.org/10.1111/ecog.06992" target="_blank" rel="noopener">read this article</a
					>. MESS also shows where the model is extrapolating: areas with values different than 0 depict extrapolation, and the value shows
					how many variables are causing it in that cell. To learn more about MESS,
					<a href="https://doi.org/10.1111/j.2041-210X.2010.00036.x" target="_blank" rel="noopener">read this article</a>.
				</p>
			</section>

			<section class="cell json-cell">
				<h3>Model details</h3>
				{#if jsonLoading}
					<p class="hint">Loading…</p>
				{:else if rawLog}
					<div class="json-columns">
						<div class="json-col">
							<JsonViewer label="Model details" value={rawLog} />
						</div>
						<div class="json-col">
							<JsonViewer label="What are the properties" value={explanation} />
						</div>
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>
{/if}

<style>
	.additional-details {
		margin-top: 0.75rem;
	}
	.toolbar-row {
		display: flex;
		justify-content: center;
		gap: 0.6rem;
	}
	.toggle-btn {
		background: #ffffff;
		border: 1px solid #006cd7;
		color: #006cd7;
		border-radius: 999px;
		padding: 0.4rem 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.toggle-btn:hover {
		background: #eef6ff;
	}
	.report-btn {
		background: #0f9d78;
		border: 1px solid #0f9d78;
		color: #ffffff;
		border-radius: 999px;
		padding: 0.4rem 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}
	.report-btn:hover {
		background: #0c8266;
		border-color: #0c8266;
	}

	.details-grid {
		display: grid;
		grid-template-columns: 1.3fr 1.7fr;
		grid-template-rows: auto auto;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	@media (max-width: 900px) {
		.details-grid {
			grid-template-columns: 1fr;
		}
	}
	.json-cell {
		grid-column: 1 / -1;
	}

	.cell {
		background: #ffffff;
		border: 1px solid #d8d8d8;
		border-radius: 10px;
		padding: 0.75rem 0.9rem;
	}
	.cell h3 {
		margin: 0 0 0.6rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: #006cd7;
	}

	.hint {
		font-size: 0.72rem;
		color: #94a3b8;
		margin: 0 0 0.5rem;
	}
	.hint.error {
		color: #dc2626;
	}

	.bias-cell :global(.envelope-chart) {
		margin-bottom: 0.9rem;
	}

	.explain {
		font-size: 0.68rem;
		color: #64748b;
		line-height: 1.55;
		margin: 0.75rem 0 0;
	}
	.explain a {
		color: #006cd7;
	}

	.combo-select {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		color: #475569;
		margin-bottom: 0.6rem;
	}
	.combo-select select {
		flex: 1;
		max-width: 220px;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.25rem 0.35rem;
		font-size: 0.72rem;
	}

	.preview-row {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.preview-row figure {
		/* Not `flex: 1` (= flex-basis: 0%) — in a column flex container with
		   no explicit height, that decouples each figure's box height from
		   its <img>'s actual rendered height (width:100% + height:auto keeps
		   the image's own aspect ratio), so the next figure gets positioned
		   under the *box*, not the visually taller image — the two previews
		   overlapped. `flex: none` (basis: auto) sizes each figure to its
		   natural content height instead, which stacks correctly. Browsers
		   also give <figure> a default 16px 40px margin — reset it so the
		   images go full-width instead of inset by 40px on each side. */
		flex: none;
		margin: 0;
	}
	.preview-row figcaption {
		font-size: 0.68rem;
		font-weight: 600;
		color: #475569;
		margin-bottom: 0.25rem;
	}
	.preview-row img {
		width: 100%;
		height: auto;
		border-radius: 6px;
		border: 1px solid #ebebeb;
		display: block;
	}
	.preview-placeholder {
		aspect-ratio: 2 / 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f6f6f6;
		border-radius: 6px;
		font-size: 0.68rem;
		color: #94a3b8;
	}

	.json-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}
	@media (max-width: 700px) {
		.json-columns {
			grid-template-columns: 1fr;
		}
	}
</style>
