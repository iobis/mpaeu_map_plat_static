<script lang="ts">
	/**
	 * ResponseCurveChart.svelte
	 *
	 * A predictor's partial response curve, rendered with Observable Plot
	 * (`@observablehq/plot`) for hover tooltips — chosen over Plotly per the
	 * user's explicit preference (lighter weight, still real interactivity).
	 * Plot renders imperatively into a plain DOM node, so it's mounted via a
	 * Svelte 5 attachment (`{@attach}`) rather than `bind:this` + a separate
	 * `$effect` — attachments are the sanctioned way to hand an element off
	 * to an imperative-DOM library: the callback re-runs (with its previous
	 * return value's cleanup called first) whenever a reactive value read
	 * inside it changes, exactly like `$effect`, and only ever runs in the
	 * browser (never during SSR/prerendering). Still shades the x-range
	 * where `inRange` is false (points outside the model's training data
	 * range for that variable), same as the previous hand-rolled version.
	 *
	 * Sized via `ResizeObserver`, not a fixed aspect ratio — Plot needs
	 * literal pixel `width`/`height`, and the previous `viewBox`-scaled
	 * `width:100%; height:auto` approach ties the rendered height to the
	 * container's *width* times a constant ratio, which only happens to fit
	 * the fixed-height grid cell (`grid-auto-rows: 320px` in
	 * ResultsGrid.svelte) at some viewport widths and overflows it at
	 * others. Observing the host div's actual `clientWidth`/`clientHeight`
	 * (itself sized by flexbox to fill whatever the cell leaves after its
	 * heading etc.) makes the chart genuinely fill its box instead.
	 */
	import * as Plot from '@observablehq/plot';
	import type { RespCurvePoint } from '$lib/data/species-metrics-loader.js';

	interface Props {
		points: RespCurvePoint[];
	}

	let { points }: Props = $props();

	// Contiguous x-spans where inRange is false, as background shading rects.
	const outOfRangeSpans = $derived.by(() => {
		const spans: { a: number; b: number }[] = [];
		let start: number | null = null;
		for (let i = 0; i < points.length; i++) {
			if (!points[i].inRange && start === null) start = points[i].base;
			if (points[i].inRange && start !== null) {
				spans.push({ a: start, b: points[i - 1].base });
				start = null;
			}
		}
		if (start !== null) spans.push({ a: start, b: points[points.length - 1].base });
		return spans;
	});

	function renderPlot(node: HTMLDivElement) {
		if (!points.length) return;

		function draw() {
			const width = node.clientWidth;
			const height = node.clientHeight;
			// Below this, the fixed 34/10px left/right margins alone leave Plot
			// no positive inner frame to lay marks out in — observed producing
			// a degenerate (invisible, sometimes negative-width-rect) chart
			// during a container's very first, still-settling layout pass.
			if (width < 60 || height < 30) return;

			const yMin = Math.min(0, ...points.map((p) => p.response));
			const yMaxData = Math.max(...points.map((p) => p.response));
			// A little headroom above the highest point, so Plot.tip's hover box
			// (which anchors near the hovered value) always has room to render
			// without clipping against the top of the plot's own canvas.
			const yMax = yMaxData + (yMaxData - yMin) * 0.15;

			const plot = Plot.plot({
				width,
				height,
				marginLeft: 34,
				marginRight: 10,
				marginTop: 22,
				marginBottom: 24,
				x: { label: null },
				y: { label: null, domain: [yMin, yMax] },
				style: { fontSize: '9px', background: 'transparent' },
				marks: [
					Plot.rectY(outOfRangeSpans, { x1: 'a', x2: 'b', y1: yMin, y2: yMax, fill: '#fee2e2', fillOpacity: 0.6 }),
					Plot.ruleY([0], { stroke: '#d4d4d4' }),
					Plot.line(points, { x: 'base', y: 'response', stroke: '#006cd7', strokeWidth: 1.6 }),
					Plot.tip(
						points,
						Plot.pointerX({
							x: 'base',
							y: 'response',
							anchor: 'top',
							title: (d: RespCurvePoint) => `${d.base.toPrecision(3)}\nresponse: ${d.response.toPrecision(3)}${d.inRange ? '' : '\n(outside training range)'}`
						})
					)
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

<div class="chart-host" {@attach renderPlot} role="img" aria-label="Response curve"></div>

<!-- For now keep the hint always on -->
<!-- {#if outOfRangeSpans.length} -->
<p class="hint"><span class="swatch" aria-hidden="true"></span>Shaded region: outside the training data's observed range for this variable.</p>
<!-- {/if} -->

<style>
	.chart-host {
		flex: 1;
		min-height: 0;
		width: 100%;
	}
	.chart-host :global(svg) {
		display: block;
	}
	.hint {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.62rem;
		color: #94a3b8;
		margin: 0.3rem 0 0;
	}
	.swatch {
		width: 8px;
		height: 8px;
		background: #fee2e2;
		border: 1px solid #dc2626;
		border-radius: 2px;
		flex-shrink: 0;
	}
</style>
