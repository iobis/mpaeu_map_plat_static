<script lang="ts">
	/**
	 * The "Generate report" page — a client-side, print-to-PDF replacement
	 * for the Shiny app's `scripts/map_output_model.qmd`. That template gets
	 * filled in with per-species file paths and rendered to HTML via
	 * `quarto::quarto_render()` server-side (`general_functions.R`'s
	 * `gen_quarto_report()`); there's no backend here, so this route reads
	 * the exact same data straight from the browser (log.json, the metrics
	 * parquets, the occurrence points, and the 11 prediction COGs via
	 * titiler preview images) and lays it out as an ordinary web page,
	 * mirroring the Quarto template's section order 1:1.
	 *
	 * "Generate PDF" is the browser's own print dialog (`window.print()`)
	 * with print-specific CSS below — no PDF-generation library needed, and
	 * it produces a real vector/selectable-text PDF (Chromium/Firefox's
	 * native "Save as PDF" print destination) rather than a rasterized
	 * canvas snapshot the way an html2canvas+jsPDF approach would.
	 *
	 * Reached as `{base}/report/?taxonid=…&method=…` from a plain link (not
	 * a nav item) — see the "Generate report" button in AdditionalDetails.svelte.
	 */
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { Map, DeckOverlay, loadPointTable, titilerPreviewUrl, type OverlayEntry } from '$lib/components/maplibre/index.js';
	import { logUrl, metricsUrl, fitoccUrl, predictionUrl, SCENARIO_PERIOD_COMBOS, MODEL_LABELS, type ModelMethod } from '$lib/data/species-catalogue.js';
	import {
		loadCvMetrics,
		loadVarImportance,
		loadRespCurves,
		humanizeVariable,
		type MetricRow,
		type VarImportanceRow,
		type RespCurvePoint
	} from '$lib/data/species-metrics-loader.js';
	import { loadReportData, humanizeReportVariable, type ReportData } from '$lib/data/report-data-loader.js';
	import ResponseCurveChart from '$lib/components/species/ResponseCurveChart.svelte';
	import { PUBLIC_TITILER_URL } from '$env/static/public';

	const taxonID = $derived.by(() => {
		const raw = page.url.searchParams.get('taxonid');
		const n = raw ? Number(raw) : NaN;
		return Number.isFinite(n) ? n : null;
	});
	const method = $derived(page.url.searchParams.get('method') as ModelMethod | null);

	let report = $state<ReportData | null>(null);
	let cvMetrics = $state<MetricRow[]>([]);
	let varImportance = $state<VarImportanceRow[]>([]);
	let respCurves = $state<globalThis.Map<string, RespCurvePoint[]>>(new globalThis.Map());
	let points = $state<{ lon: number; lat: number }[]>([]);
	let loading = $state(true);
	let loadError = $state(false);

	$effect(() => {
		const id = taxonID;
		const m = method;
		if (!id || !m) {
			loading = false;
			return;
		}
		loading = true;
		loadError = false;
		Promise.all([
			loadReportData(logUrl(id), m),
			loadCvMetrics(metricsUrl(id, m, 'cvmetrics')),
			loadVarImportance(metricsUrl(id, m, 'varimportance')),
			loadRespCurves(metricsUrl(id, m, 'respcurves')),
			loadPointTable(fitoccUrl(id), { lonField: 'decimalLongitude', latField: 'decimalLatitude' })
		])
			.then(([rep, cv, vi, rc, pts]) => {
				report = rep;
				cvMetrics = cv;
				varImportance = vi;
				respCurves = rc;
				points = pts;
			})
			.catch((e) => {
				console.error('[report] Failed to load report data:', e);
				loadError = true;
			})
			.finally(() => (loading = false));
	});

	const bounds = $derived.by((): [[number, number], [number, number]] | undefined => {
		if (!points.length) return undefined;
		let minLon = Infinity,
			maxLon = -Infinity,
			minLat = Infinity,
			maxLat = -Infinity;
		for (const p of points) {
			if (p.lon < minLon) minLon = p.lon;
			if (p.lon > maxLon) maxLon = p.lon;
			if (p.lat < minLat) minLat = p.lat;
			if (p.lat > maxLat) maxLat = p.lat;
		}
		return [
			[minLon, minLat],
			[maxLon, maxLat]
		];
	});

	const overlayEntries = $derived<OverlayEntry[]>(
		taxonID && points.length
			? [
					{
						layerKind: 'table',
						zIndex: 0,
						id: 'report-points',
						url: fitoccUrl(taxonID),
						lonField: 'decimalLongitude',
						latField: 'decimalLatitude',
						opacity: 0.7,
						visible: true,
						color: '#1e3a8a'
					}
				]
			: []
	);

	function successfulModels(modelResult: Record<string, string>): string {
		return Object.entries(modelResult)
			.filter(([, status]) => status === 'succeeded')
			.map(([m]) => m)
			.join(', ');
	}

	function timeSum(timings: ReportData['timings'], whats: string[]): number {
		return timings.filter((t) => whats.includes(t.what)).reduce((s, t) => s + t.timeMins, 0);
	}

	function printReport() {
		window.print();
	}
</script>

<svelte:head>
	<title>Species report{report ? ` — ${report.scientificName}` : ''}</title>
</svelte:head>

{#if !taxonID || !method}
	<div class="state-msg">
		<p>Missing species/model — open this page from the "Generate report" button on the Species tab.</p>
	</div>
{:else if loading}
	<div class="state-msg">
		<p>Loading report…</p>
	</div>
{:else if loadError || !report}
	<div class="state-msg">
		<p>Failed to load this species' report data.</p>
	</div>
{:else}
	<div class="toolbar no-print">
		<a class="back-link" href="{base}/">← Back to the app</a>
		<button type="button" class="print-btn" onclick={printReport}>⬇ Generate PDF (print dialog)</button>
	</div>

	<article class="report">
		<h1>Model for species <em>{report.scientificName}</em></h1>

		<section>
			<h2>Species data</h2>
			<div class="map-frame">
				<Map {bounds} renderWorldCopies={false}>
					<DeckOverlay entries={overlayEntries} />
				</Map>
			</div>
		</section>

		<section>
			<h2>Model details</h2>
			<dl class="details-list">
				<div><dt>Species</dt><dd><em>{report.scientificName}</em></dd></div>
				<div><dt>AphiaID</dt><dd>{report.taxonID}</dd></div>
				<div>
					<dt>OBIS taxon page</dt>
					<dd><a href="https://www.obis.org/taxon/{report.taxonID}" target="_blank" rel="noopener">https://www.obis.org/taxon/{report.taxonID}</a></dd>
				</div>
				<div>
					<dt>WoRMS link</dt>
					<dd
						><a href="https://www.marinespecies.org/aphia.php?p=taxdetails&id={report.taxonID}" target="_blank" rel="noopener"
							>https://marinespecies.org/aphia.php?p=taxdetails&id={report.taxonID}</a
						></dd
					>
				</div>
				<div><dt>Run acronym</dt><dd>{report.modelAcro}</dd></div>
				<div><dt>Date</dt><dd>{report.modelDate}</dd></div>
				<div><dt>Number of records</dt><dd>{report.modelFitPoints}</dd></div>
				<div><dt>Number of quadrature points</dt><dd>{report.backgroundSize}</dd></div>
				<div><dt>Model selected (this report)</dt><dd>{MODEL_LABELS[method] ?? method}</dd></div>
				<div><dt>Models executed (succeeded)</dt><dd>{successfulModels(report.modelResult)}</dd></div>
				<div><dt>Variables</dt><dd>{report.variables.map(humanizeReportVariable).join(', ')}</dd></div>
				<div>
					<dt>Time (minutes)</dt>
					<dd>
						Model fit – {timeSum(report.timings, ['Model selection', 'Model fit']).toFixed(1)} | Predictions – {timeSum(report.timings, [
							'Model prediction'
						]).toFixed(1)} | Others – {(
							report.timings.reduce((s, t) => s + t.timeMins, 0) -
							timeSum(report.timings, ['Model selection', 'Model fit', 'Model prediction'])
						).toFixed(1)}
					</dd>
				</div>
			</dl>

			<div class="callout">
				<strong>Learn how to interpret SDMs</strong>
				<p>
					Species distribution models (SDMs) are valuable tools, but it's important to understand how to interpret their results correctly.
					Check <a href="https://iobis.github.io/mpaeu_docs/understanding.html" target="_blank" rel="noopener">this article</a> to learn more.
				</p>
			</div>
		</section>

		<section>
			<h2>Model evaluation</h2>

			<h3>Metrics</h3>
			<div class="table-wrap">
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

			<h3>Variable importance</h3>
			<div class="table-wrap">
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

			<h3>Response curves</h3>
			<div class="rc-grid">
				{#each [...respCurves.entries()] as [variable, pts] (variable)}
					<div class="rc-cell">
						<h4>{humanizeVariable(variable)}</h4>
						<div class="rc-chart"><ResponseCurveChart points={pts} /></div>
					</div>
				{/each}
			</div>
		</section>

		<section class="page-break">
			<h2>Predictions</h2>
			<div class="pred-grid">
				{#each SCENARIO_PERIOD_COMBOS as combo (combo.value)}
					<figure>
						<figcaption>{combo.label}</figcaption>
						<img
							src={titilerPreviewUrl(PUBLIC_TITILER_URL, predictionUrl(report.taxonID, method, combo.scenario, combo.period), {
								rescale: [0, 100],
								colormapName: 'blues',
								maxSize: 400
							})}
							alt="Prediction — {combo.label}"
							loading="lazy"
						/>
					</figure>
				{/each}
			</div>
		</section>

		<section>
			<h2>Model post-evaluation</h2>
			<dl class="details-list">
				<div>
					<dt>Thermal range (Q0.05 / Q0.95)</dt>
					<dd>
						{report.postEval.thermalRangeQ05 != null ? report.postEval.thermalRangeQ05.toFixed(1) : '—'} / {report.postEval.thermalRangeQ95 !=
						null
							? report.postEval.thermalRangeQ95.toFixed(1)
							: '—'}
					</dd>
				</div>
				<div>
					<dt>Inside thermal envelope?</dt>
					<dd>{report.postEval.insideEnvelope ?? '—'} ({report.postEval.envelopePercentage ?? '—'}%)</dd>
				</div>
			</dl>
			<p class="niche-title"><strong>Niche metrics (overlap between points and predicted sample of points):</strong></p>
			<ul class="niche-list">
				<li><strong>D:</strong> {typeof report.postEval.nicheD === 'number' ? report.postEval.nicheD.toFixed(1) : report.postEval.nicheD}</li>
				<li><strong>I:</strong> {typeof report.postEval.nicheI === 'number' ? report.postEval.nicheI.toFixed(1) : report.postEval.nicheI}</li>
				<li>
					<strong>Jaccard (hypervolume):</strong>
					{typeof report.postEval.hyperJaccard === 'number' ? report.postEval.hyperJaccard.toFixed(1) : report.postEval.hyperJaccard}
				</li>
				<li>
					<strong>Sorensen (hypervolume):</strong>
					{typeof report.postEval.hyperSorensen === 'number' ? report.postEval.hyperSorensen.toFixed(1) : report.postEval.hyperSorensen}
				</li>
			</ul>
		</section>

		<hr />

		<footer>
			<p>
				Produced by the <a href="https://obis.org/" target="_blank" rel="noopener">OBIS</a> team.
				<br />
				<code>obissdm</code> version {report.obissdmVersion}
			</p>
			<div class="project-note">
				<p><strong>MPA Europe project</strong></p>
				<p>
					Using a holistic range of measures that include the range of biodiversity from species to ecosystems, including habitats, areas will
					be prioritised using systematic conservation planning software. This enables alternative weighting of variables and multiple scenarios
					and thus support wider marine spatial planning.
				</p>
				<p>
					Grant Agreement 101059988 – MPA Europe | MPA Europe project has been approved under HORIZON-CL6-2021-BIODIV-01-12 — Improved science
					based maritime spatial planning and identification of marine protected areas.
				</p>
				<p>
					Co-funded by the European Union. Views and opinions expressed are however those of the authors only and do not necessarily reflect
					those of the European Union or UK Research and Innovation. Neither the European Union nor the granting authority can be held
					responsible for them.
				</p>
			</div>
		</footer>
	</article>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
		background: #f6f6f6;
		color: #1e293b;
	}

	.state-msg {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		font-size: 0.9rem;
		color: #64748b;
	}

	.toolbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1.25rem;
		background: #ffffff;
		border-bottom: 1px solid #d8d8d8;
	}
	.back-link {
		color: #006cd7;
		font-size: 0.8rem;
		text-decoration: none;
	}
	.back-link:hover {
		text-decoration: underline;
	}
	.print-btn {
		background: #006cd7;
		color: #ffffff;
		border: none;
		border-radius: 6px;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}
	.print-btn:hover {
		background: #0080ff;
	}

	.report {
		max-width: 860px;
		margin: 0 auto;
		padding: 2rem 2.5rem 4rem;
		background: #ffffff;
	}

	h1 {
		font-size: 1.5rem;
		color: #006cd7;
		border-bottom: 2px solid #006cd7;
		padding-bottom: 0.5rem;
	}
	section {
		margin-top: 2rem;
	}
	h2 {
		font-size: 1.15rem;
		color: #006cd7;
		border-bottom: 1px solid #d8d8d8;
		padding-bottom: 0.3rem;
	}
	h3 {
		font-size: 0.95rem;
		color: #1e293b;
		margin-top: 1.3rem;
	}
	h4 {
		font-size: 0.75rem;
		color: #475569;
		margin: 0 0 0.3rem;
	}

	.map-frame {
		height: 340px;
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		overflow: hidden;
	}

	.details-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.82rem;
		margin: 0.75rem 0;
	}
	.details-list > div {
		display: flex;
		gap: 0.4rem;
	}
	.details-list dt {
		flex-shrink: 0;
		width: 220px;
		font-weight: 600;
		color: #475569;
	}
	.details-list dd {
		margin: 0;
	}
	.details-list a {
		color: #006cd7;
		word-break: break-all;
	}

	.callout {
		margin-top: 1rem;
		background: #eef6ff;
		border-left: 4px solid #006cd7;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		font-size: 0.8rem;
	}
	.callout p {
		margin: 0.3rem 0 0;
		color: #334155;
	}
	.callout a {
		color: #006cd7;
	}

	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
		margin: 0.5rem 0 1rem;
	}
	th {
		background: #f0f4f8;
		text-align: left;
		padding: 0.35rem 0.5rem;
		color: #475569;
		font-weight: 600;
	}
	td {
		padding: 0.3rem 0.5rem;
		border-top: 1px solid #ebebeb;
	}

	.rc-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-top: 0.75rem;
	}
	.rc-cell {
		border: 1px solid #ebebeb;
		border-radius: 8px;
		padding: 0.6rem 0.7rem;
	}
	.rc-chart {
		height: 140px;
		display: flex;
		flex-direction: column;
	}

	.pred-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-top: 0.75rem;
	}
	.pred-grid figure {
		margin: 0;
		border: 1px solid #ebebeb;
		border-radius: 8px;
		padding: 0.5rem;
	}
	.pred-grid figcaption {
		font-size: 0.72rem;
		font-weight: 600;
		color: #475569;
		margin-bottom: 0.3rem;
		text-align: center;
	}
	.pred-grid img {
		width: 100%;
		display: block;
		border-radius: 4px;
	}

	.niche-title {
		font-size: 0.82rem;
		margin-bottom: 0.3rem;
	}
	.niche-list {
		font-size: 0.8rem;
		margin: 0;
		padding-left: 1.2rem;
	}
	.niche-list li {
		margin-bottom: 0.2rem;
	}

	hr {
		margin-top: 2rem;
		border: none;
		border-top: 1px solid #d8d8d8;
	}
	footer {
		font-size: 0.75rem;
		color: #64748b;
	}
	.project-note {
		margin-top: 0.75rem;
		font-size: 0.7rem;
	}
	.project-note p {
		margin: 0.4rem 0;
	}

	@media print {
		:global(body) {
			background: #ffffff;
		}
		.no-print {
			display: none !important;
		}
		.report {
			max-width: none;
			padding: 0;
		}
		.page-break {
			break-before: page;
		}
		.map-frame :global(.maplibregl-ctrl) {
			display: none;
		}
	}
</style>
