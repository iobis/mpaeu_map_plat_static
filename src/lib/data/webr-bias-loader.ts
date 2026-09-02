/**
 * webr-bias-loader.ts
 *
 * Reads the per-species spatial-bias RDS file (`biasmetrics.rds` — a plain
 * R `list(k_stat=<spatstat envelope>, l_stat=<spatstat envelope>)`) and
 * extracts the K-function/L-function envelope data (r/obs/theo/lo/hi
 * columns) as plain JS arrays, so `EnvelopeChart.svelte` can plot them.
 *
 * Why webR and not a pure-JS RDS parser: tried
 * `@jackemcpherson/rds-js` first (zero-dep, much lighter) against a real
 * production file and it threw `UnsupportedTypeError: SEXPTYPE 6` — the
 * spatstat `envelope`/`fv` object carries R language/formula objects as
 * attributes (e.g. `attr(x, "fmla")`), which that parser correctly refuses
 * to touch since it only targets plain tabular data. A full R engine
 * doesn't care about those attributes when we only read `$r`/`$obs`/etc.,
 * so webR (real R, compiled to WASM) sidesteps the problem entirely — and
 * since it's only used for this one feature, it's loaded lazily from
 * r-wasm.org's CDN as a plain dynamic `import()`, never bundled, and only
 * on first use of "Show additional details". Verified against the real
 * taxonid=243036 file in an actual browser before relying on this — the
 * extracted values matched a native `Rscript` readRDS() run exactly.
 */

const WEBR_CDN_URL = 'https://webr.r-wasm.org/v0.6.0/webr.mjs';

export interface EnvelopePoints {
	r: number[];
	obs: number[];
	theo: number[];
	lo: number[];
	hi: number[];
}

export interface BiasEnvelopes {
	k: EnvelopePoints;
	l: EnvelopePoints;
}

// Minimal surface of the webR JS API this module actually uses.
interface WebRInstance {
	init(): Promise<void>;
	FS: {
		writeFile(path: string, data: Uint8Array): Promise<void>;
		unlink(path: string): Promise<void>;
	};
	evalR(code: string): Promise<{ toArray(): Promise<unknown[]> }>;
	destroy(obj: unknown): void;
}

let webRPromise: Promise<WebRInstance> | null = null;

async function getWebR(): Promise<WebRInstance> {
	if (!webRPromise) {
		webRPromise = (async () => {
			const mod = (await import(/* @vite-ignore */ WEBR_CDN_URL)) as {
				WebR: new () => WebRInstance;
			};
			const webR = new mod.WebR();
			await webR.init();
			return webR;
		})();
	}
	return webRPromise;
}

let fileCounter = 0;

const VECTOR_KEYS = ['k_r', 'k_obs', 'k_theo', 'k_lo', 'k_hi', 'l_r', 'l_obs', 'l_theo', 'l_lo', 'l_hi'] as const;

export async function loadBiasEnvelopes(rdsUrl: string): Promise<BiasEnvelopes> {
	const webR = await getWebR();

	const resp = await fetch(rdsUrl);
	if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${rdsUrl}`);
	const bytes = new Uint8Array(await resp.arrayBuffer());

	const path = `/tmp/bias_${fileCounter++}.rds`;
	await webR.FS.writeFile(path, bytes);

	try {
		const assign = await webR.evalR(`bias <- readRDS(${JSON.stringify(path)})`);
		webR.destroy(assign);

		// Single round trip: pack all 10 numeric columns into one
		// comma/semicolon-delimited string rather than relying on webR's
		// nested toJs() list shape, which is harder to get exactly right
		// than a flat string split in JS.
		const code = `
			vecs <- list(
				k_r=bias$k_stat$r, k_obs=bias$k_stat$obs, k_theo=bias$k_stat$theo, k_lo=bias$k_stat$lo, k_hi=bias$k_stat$hi,
				l_r=bias$l_stat$r, l_obs=bias$l_stat$obs, l_theo=bias$l_stat$theo, l_lo=bias$l_stat$lo, l_hi=bias$l_stat$hi
			)
			paste(sapply(vecs, function(v) paste(v, collapse=",")), collapse=";")
		`;
		const result = await webR.evalR(code);
		const [packed] = (await result.toArray()) as [string];
		webR.destroy(result);

		const groups = packed.split(';').map((s) => s.split(',').map(Number));
		const values: Record<(typeof VECTOR_KEYS)[number], number[]> = Object.fromEntries(
			VECTOR_KEYS.map((key, i) => [key, groups[i]])
		) as never;

		return {
			k: { r: values.k_r, obs: values.k_obs, theo: values.k_theo, lo: values.k_lo, hi: values.k_hi },
			l: { r: values.l_r, obs: values.l_obs, theo: values.l_theo, lo: values.l_lo, hi: values.l_hi }
		};
	} finally {
		await webR.FS.unlink(path).catch(() => {});
	}
}
