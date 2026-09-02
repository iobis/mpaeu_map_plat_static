<script lang="ts">
	/**
	 * ThermalDensityChart.svelte
	 *
	 * Approximates the density plot from `components/contextualinfo.R`'s
	 * thermal branch — a kernel density of sea-surface temperature at the
	 * species' occurrence points, with vertical lines marking the current
	 * median/Q5/Q95 and each future scenario's 2100 median. The Shiny app
	 * builds the *real* density from per-point SST values it extracts from
	 * a local Bio-ORACLE raster at request time; that raster isn't part of
	 * the public S3 bucket this rewrite otherwise gets everything from, so
	 * this instead draws a Gaussian curve from `thermmetrics.json`'s own
	 * precomputed mean/sd for the current scenario — mathematically an
	 * approximation, not a literal resample, which the caption says
	 * outright rather than passing it off as the original.
	 *
	 * Rendered with Observable Plot for hover tooltips (see
	 * ResponseCurveChart.svelte for why, and for why it's mounted via a
	 * Svelte 5 attachment rather than `bind:this` + `$effect`): the curve
	 * gets a pointer-tracking tip, and each vertical scenario line gets a
	 * native `title` (a plain SVG/browser tooltip on hover — simpler than
	 * wiring every rule into Plot's own pointer interaction, and perfectly
	 * adequate for a static vertical line).
	 *
	 * Sized via `ResizeObserver` against the host div's actual rendered box
	 * (see ResponseCurveChart.svelte for why — a fixed aspect ratio scaled
	 * off container width alone doesn't respect this cell's fixed height,
	 * and can push the legend/caption below it out of view).
	 */
	import * as Plot from '@observablehq/plot';
	import type { ThermLimitRow } from '$lib/data/thermal-metrics-loader.js';
	import { scenarioLabel } from '$lib/data/thermal-metrics-loader.js';

	interface Props {
		limits: ThermLimitRow[];
	}
	let { limits }: Props = $props();

	const SSP_SCENARIOS = ['ssp126', 'ssp245', 'ssp370', 'ssp460', 'ssp585'];
	const SSP_COLORS: Record<string, string> = {
		ssp126: '#9ecae1',
		ssp245: '#6baed6',
		ssp370: '#4292c6',
		ssp460: '#2171b5',
		ssp585: '#084594'
	};
	const CURRENT_COLOR = '#e01156';
	const QUANTILE_COLOR = '#94a3b8';

	const current = $derived(limits.find((l) => l.scenario === 'current'));
	const futureMedians = $derived(
		SSP_SCENARIOS.map((s) => limits.find((l) => l.scenario === s && l.period === 'dec100')).filter((l): l is ThermLimitRow => !!l)
	);

	function gaussian(x: number, mean: number, sd: number): number {
		return Math.exp(-((x - mean) ** 2) / (2 * sd ** 2)) / (sd * Math.sqrt(2 * Math.PI));
	}

	interface ThermRuleRow {
		x: number;
		color: string;
		label: string;
		width: number;
	}

	function renderPlot(node: HTMLDivElement) {
		const c = current;
		if (!c) return;

		function draw() {
			if (!c) return;
			const width = node.clientWidth;
			const height = node.clientHeight;
			// See ResponseCurveChart.svelte's identical guard — below this, the
			// fixed margins alone leave no positive inner frame to lay out in.
			if (width < 60 || height < 30) return;

			const candidates = [c.mean - 3.5 * c.sd, c.mean + 3.5 * c.sd, c.q05, c.q95, ...futureMedians.map((l) => l.q50)];
			const xMin = Math.min(...candidates);
			const xMax = Math.max(...candidates);

			const n = 120;
			const curve = Array.from({ length: n + 1 }, (_, i) => {
				const temp = xMin + ((xMax - xMin) * i) / n;
				return { temp, density: gaussian(temp, c.mean, c.sd) };
			});
			// Headroom above the curve's peak so Plot.tip's hover box has room to
			// render without clipping against the top of the plot's own canvas.
			const peakDensity = gaussian(c.mean, c.mean, c.sd);

			const quantileRules: ThermRuleRow[] = [
				{ x: c.q05, color: QUANTILE_COLOR, label: 'Q5% (current)', width: 1 },
				{ x: c.q95, color: QUANTILE_COLOR, label: 'Q95% (current)', width: 1 }
			];
			const medianRules: ThermRuleRow[] = [
				{ x: c.q50, color: CURRENT_COLOR, label: 'Median current', width: 1.6 },
				...futureMedians.map((l) => ({
					x: l.q50,
					color: SSP_COLORS[l.scenario],
					label: `Median ${scenarioLabel(l.scenario)}-2100`,
					width: 1.4
				}))
			];

			const plot = Plot.plot({
				width,
				height,
				marginLeft: 10,
				marginRight: 10,
				marginTop: 26,
				marginBottom: 24,
				x: { label: 'Sea temperature (°C)', labelAnchor: 'center' },
				y: { axis: null, domain: [0, peakDensity * 1.25] },
				style: { fontSize: '9px', background: 'transparent' },
				marks: [
					Plot.areaY(curve, { x: 'temp', y: 'density', fill: '#f1f5f9' }),
					Plot.line(curve, { x: 'temp', y: 'density', stroke: '#64748b', strokeWidth: 1.3 }),
					// Two separate rule marks, not one with a per-datum `strokeDasharray`
					// accessor — Plot types that option as a plain constant, not a channel.
					Plot.ruleX(quantileRules, {
						x: 'x',
						stroke: (d: ThermRuleRow) => d.color,
						strokeWidth: (d: ThermRuleRow) => d.width,
						strokeDasharray: '3,2',
						title: (d: ThermRuleRow) => `${d.label}: ${d.x.toFixed(1)}°C`
					}),
					Plot.ruleX(medianRules, {
						x: 'x',
						stroke: (d: ThermRuleRow) => d.color,
						strokeWidth: (d: ThermRuleRow) => d.width,
						title: (d: ThermRuleRow) => `${d.label}: ${d.x.toFixed(1)}°C`
					}),
					Plot.tip(curve, Plot.pointerX({ x: 'temp', y: 'density', anchor: 'top', title: (d: { temp: number }) => `${d.temp.toFixed(1)}°C` }))
				]
			});
			node.replaceChildren(plot);
		}

		draw();
		const ro = new ResizeObserver(draw);
		ro.observe(node);
		return () => ro.disconnect();
	}
</script>

{#if current}
	<div class="chart-host" {@attach renderPlot} role="img" aria-label="Approximate thermal-range density"></div>

	<div class="legend">
		<span><i class="swatch" style="background:{CURRENT_COLOR}" aria-hidden="true"></i>Median current</span>
		<span><i class="swatch dashed" aria-hidden="true"></i>Q5% / Q95% (current)</span>
		{#each futureMedians as l (l.scenario)}
			<span><i class="swatch" style="background:{SSP_COLORS[l.scenario]}" aria-hidden="true"></i>Median {scenarioLabel(l.scenario)}-2100</span>
		{/each}
	</div>
	<p class="hint">
		Approximated from the current scenario's mean/SD of sea temperature at occurrence points (not a literal recomputed density — see "How this data is
		extracted"). Hover the curve or a line for exact values.
	</p>
{/if}

<style>
	.chart-host {
		flex: 1;
		min-height: 0;
		width: 100%;
	}
	.chart-host :global(svg) {
		display: block;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.6rem;
		color: #64748b;
		margin-top: 0.3rem;
		flex-shrink: 0;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}
	.swatch {
		width: 9px;
		height: 2px;
		display: inline-block;
	}
	.swatch.dashed {
		background: repeating-linear-gradient(to right, #94a3b8 0, #94a3b8 3px, transparent 3px, transparent 5px);
	}
	.hint {
		font-size: 0.6rem;
		color: #94a3b8;
		margin: 0.35rem 0 0;
		line-height: 1.4;
		flex-shrink: 0;
	}
</style>
