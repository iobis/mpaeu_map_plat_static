<script lang="ts">
	/**
	 * EnvelopeChart.svelte
	 *
	 * Hand-rolled SVG reproduction of spatstat's `plot.envelope` default look
	 * (shaded lo/hi simulation envelope + theoretical CSR line + observed
	 * line) for the K-function/L-function spatial-bias diagnostics — see
	 * webr-bias-loader.ts for how the data is extracted from the RDS file.
	 */
	import type { EnvelopePoints } from '$lib/data/webr-bias-loader.js';

	interface Props {
		points: EnvelopePoints;
		title: string;
		width?: number;
		height?: number;
	}

	let { points, title, width = 320, height = 220 }: Props = $props();

	const PAD_L = 38;
	const PAD_R = 10;
	const PAD_T = 22;
	const PAD_B = 26;

	const xMin = $derived(Math.min(...points.r));
	const xMax = $derived(Math.max(...points.r));
	const yMin = $derived(Math.min(0, ...points.lo, ...points.obs, ...points.theo));
	const yMax = $derived(Math.max(...points.hi, ...points.obs, ...points.theo));

	function xPix(x: number, w: number): number {
		const span = xMax - xMin || 1;
		return PAD_L + ((x - xMin) / span) * (w - PAD_L - PAD_R);
	}
	function yPix(y: number, h: number): number {
		const span = yMax - yMin || 1;
		return h - PAD_B - ((y - yMin) / span) * (h - PAD_T - PAD_B);
	}

	function line(xs: number[], ys: number[], w: number, h: number): string {
		return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${xPix(x, w).toFixed(1)},${yPix(ys[i], h).toFixed(1)}`).join(' ');
	}

	const ribbonD = $derived.by(() => {
		const top = points.r.map((x, i) => [xPix(x, width), yPix(points.hi[i], height)]);
		const bottom = points.r
			.map((x, i) => [xPix(x, width), yPix(points.lo[i], height)])
			.reverse();
		const all = [...top, ...bottom];
		return all.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';
	});
	const obsD = $derived(line(points.r, points.obs, width, height));
	const theoD = $derived(line(points.r, points.theo, width, height));
</script>

<figure class="envelope-chart">
	<figcaption>{title}</figcaption>
	<svg viewBox="0 0 {width} {height}" role="img" aria-label="{title} envelope plot">
		<path d={ribbonD} fill="#dbeafe" stroke="none" />
		<line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={height - PAD_B} stroke="#d4d4d4" />
		<line x1={PAD_L} y1={height - PAD_B} x2={width - PAD_R} y2={height - PAD_B} stroke="#d4d4d4" />
		<path d={theoD} fill="none" stroke="#94a3b8" stroke-width="1.3" stroke-dasharray="4 3" />
		<path d={obsD} fill="none" stroke="#006cd7" stroke-width="1.6" />

		<text x={PAD_L} y={height - 6} font-size="9" fill="#64748b">{xMin.toPrecision(2)}</text>
		<text x={width - PAD_R} y={height - 6} font-size="9" fill="#64748b" text-anchor="end">{xMax.toPrecision(2)}</text>
		<text x={4} y={PAD_T + 6} font-size="9" fill="#64748b">{yMax.toPrecision(2)}</text>
		<text x={4} y={height - PAD_B} font-size="9" fill="#64748b">{yMin.toPrecision(2)}</text>
	</svg>
	<div class="legend">
		<span><i class="swatch obs" aria-hidden="true"></i>Observed</span>
		<span><i class="swatch theo" aria-hidden="true"></i>Theoretical CSR</span>
		<span><i class="swatch env" aria-hidden="true"></i>Simulation envelope</span>
	</div>
</figure>

<style>
	.envelope-chart {
		margin: 0;
	}
	figcaption {
		font-size: 0.72rem;
		font-weight: 600;
		color: #475569;
		margin-bottom: 0.15rem;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		font-size: 0.62rem;
		color: #64748b;
		margin-top: 0.2rem;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.swatch {
		width: 9px;
		height: 9px;
		border-radius: 2px;
		display: inline-block;
	}
	.swatch.obs {
		background: #006cd7;
	}
	.swatch.theo {
		background: #94a3b8;
	}
	.swatch.env {
		background: #dbeafe;
		border: 1px solid #bfdbfe;
	}
</style>
