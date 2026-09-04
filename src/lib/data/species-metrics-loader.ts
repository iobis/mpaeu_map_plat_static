/**
 * species-metrics-loader.ts
 *
 * Client-side readers for the per-species model-quality parquet/JSON files
 * (cvmetrics, varimportance, respcurves, thresholds, log) that back the
 * "contextual results" section below the map in the Shiny app. Uses
 * hyparquet, same as point-table-loader.ts — no WASM. Fetches each file's
 * full bytes (via parquet-fetch.ts) rather than hyparquet's own HTTP
 * range-based reader — see that file for why (breaks under GitHub Pages'
 * gzip-compressing CDN).
 *
 * All reshaping here was written against real parsed output from the actual
 * files for taxonid=243036 (columns/shapes confirmed empirically, not
 * guessed from the Shiny R source), so column names below are exact.
 */

import { parquetReadObjects } from 'hyparquet';
import { fetchParquetBuffer } from './parquet-fetch.js';

// ── Model metrics table (cvmetrics.parquet) ──────────────────────────────────
// One row per CV fold. Columns: unthresholded (auc, cbi, pr, prg) plus
// {metric}_{threshold} for metric in [tss,spec,sens,kap,fmeas,opr,upr] and
// threshold in [maxsss,mtp,p10].

export interface MetricRow {
	metric: string;
	threshold: string;
	mean: number;
	sd: number;
}

const UNTHRESHOLDED_METRICS = ['auc', 'cbi', 'pr', 'prg'];
const THRESHOLDED_METRICS = ['tss', 'spec', 'sens', 'kap', 'fmeas', 'opr', 'upr'];
const THRESHOLD_LABELS: Record<string, string> = {
	maxsss: 'Max. Sens. + Spec.',
	mtp: 'Min. train. pres.',
	p10: '10th perc. train. pres.'
};

function mean(xs: number[]): number {
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sd(xs: number[]): number {
	const m = mean(xs);
	return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export async function loadCvMetrics(url: string): Promise<MetricRow[]> {
	const file = await fetchParquetBuffer(url);
	const rows = (await parquetReadObjects({ file })) as Record<string, number>[];
	if (!rows.length) return [];

	const out: MetricRow[] = [];
	for (const metric of UNTHRESHOLDED_METRICS) {
		const values = rows.map((r) => r[metric]).filter((v) => Number.isFinite(v));
		if (!values.length) continue;
		out.push({ metric: metric.toUpperCase(), threshold: '', mean: mean(values), sd: sd(values) });
	}
	for (const metric of THRESHOLDED_METRICS) {
		for (const [thresholdKey, thresholdLabel] of Object.entries(THRESHOLD_LABELS)) {
			const col = `${metric}_${thresholdKey}`;
			const values = rows.map((r) => r[col]).filter((v) => Number.isFinite(v));
			if (!values.length) continue;
			out.push({ metric: metric.toUpperCase(), threshold: thresholdLabel, mean: mean(values), sd: sd(values) });
		}
	}
	return out;
}

// ── Variable importance table (varimportance.parquet) ────────────────────────

export interface VarImportanceRow {
	variable: string;
	label: string;
	mean: number;
	sd: number;
}

// Covers every variable in mpaeu_map_platform's data/sdm_conf.yml (the
// actual predictor set used to fit these models, across all 4 sdm_groups),
// not just the ones the original single demo species happened to use.
const VAR_BASE_LABELS: Record<string, string> = {
	thetao: 'sea temperature',
	tas: 'air temperature',
	siconc: 'sea ice concentration',
	bathymetry: 'bathymetry',
	so: 'salinity',
	o2: 'oxygen concentration',
	sws: 'sea water speed',
	par: 'photosynthetically available radiation',
	no3: 'nitrate concentration',
	po4: 'phosphate concentration',
	si: 'silicate concentration',
	rugosity: 'seafloor rugosity',
	distcoast: 'distance to coast',
	wavefetch: 'wave fetch',
	chl: 'chlorophyll concentration'
};
const SUFFIX_LABELS: Record<string, string> = { mean: 'Mean', min: 'Min.', max: 'Max.', range: 'Range of' };

export function humanizeVariable(variable: string): string {
	const m = variable.match(/^(.*)_(mean|min|max|range)$/);
	if (m && VAR_BASE_LABELS[m[1]]) return `${SUFFIX_LABELS[m[2]]} ${VAR_BASE_LABELS[m[1]]}`;
	return VAR_BASE_LABELS[variable] ?? variable;
}

export async function loadVarImportance(url: string): Promise<VarImportanceRow[]> {
	const file = await fetchParquetBuffer(url);
	const rows = (await parquetReadObjects({ file })) as { variable: string; mean: number; sd: number }[];
	return rows
		.map((r) => ({ variable: r.variable, label: humanizeVariable(r.variable), mean: r.mean, sd: r.sd }))
		.sort((a, b) => b.mean - a.mean);
}

// ── Response curves (respcurves.parquet) ──────────────────────────────────────

export interface RespCurvePoint {
	base: number;
	response: number;
	inRange: boolean;
}

export async function loadRespCurves(url: string): Promise<Map<string, RespCurvePoint[]>> {
	const file = await fetchParquetBuffer(url);
	const rows = (await parquetReadObjects({ file })) as {
		variable: string;
		response: number;
		base: number;
		in_range: number;
	}[];
	const byVar = new Map<string, RespCurvePoint[]>();
	for (const r of rows) {
		const arr = byVar.get(r.variable) ?? [];
		arr.push({ base: r.base, response: r.response, inRange: r.in_range === 1 });
		byVar.set(r.variable, arr);
	}
	for (const arr of byVar.values()) arr.sort((a, b) => a.base - b.base);
	return byVar;
}

// ── Thresholds (thresholds.parquet) ───────────────────────────────────────────
// Fractions in [0,1] — the raster's own suitability scale is 0-100, so
// callers multiply by 100 before using these as a rescale-domain floor.

export interface ThresholdsRow {
	model: string;
	p10: number;
	mtp: number;
	max_kappa: number;
	max_spec_sens: number;
	no_omission: number;
	equal_prevalence: number;
	equal_sens_spec: number;
}

export async function loadThresholds(url: string, method: string): Promise<ThresholdsRow | null> {
	const file = await fetchParquetBuffer(url);
	const rows = (await parquetReadObjects({ file })) as ThresholdsRow[];
	return rows.find((r) => r.model === method) ?? rows[0] ?? null;
}

// ── Fit log (log.json) ────────────────────────────────────────────────────────
// R's toJSON wraps every scalar in nested single-element arrays
// (e.g. `"scientificName": [["...text..."]]`) — unwrap recursively.

function unwrap(v: unknown): unknown {
	return Array.isArray(v) ? unwrap(v[0]) : v;
}

/**
 * General-purpose version of the same R `toJSON`-boxing fix, for displaying
 * a *whole* raw R-originated JSON document (e.g. the "Model details" JSON
 * tree) rather than plucking out a few known-scalar fields: recursively
 * unboxes every length-1 array into its single (recursively-unboxed)
 * element, at every level, so e.g. `{"taxonID": [[243036]]}` reads as
 * `{"taxonID": 244036}` instead of a tree of meaningless "0" index nodes.
 * Arrays with more than one element are left as arrays (just with each
 * element itself unboxed) — genuine lists (e.g. `algorithms: ["rf","xgboost"]`
 * boxed as `[["rf"],["xgboost"]]`) still read as lists, not as a single
 * merged value.
 */
export function unboxRJson(value: unknown): unknown {
	if (Array.isArray(value)) {
		if (value.length === 1) return unboxRJson(value[0]);
		return value.map(unboxRJson);
	}
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, unboxRJson(v)]));
	}
	return value;
}

export interface SpeciesLog {
	scientificName?: string;
	group?: string;
	habDepth?: string;
	rangeDepthMin?: number;
	rangeDepthMax?: number;
	modelDate?: string;
	nFitPoints?: number;
	modelGood?: boolean;
	modelGoodMetric?: string;
	modelGoodThreshold?: number;
}

export async function loadSpeciesLog(url: string): Promise<SpeciesLog> {
	const raw = (await (await fetch(url)).json()) as Record<string, unknown>;
	const rangeDepth = raw.range_depth as unknown[] | undefined;
	return {
		scientificName: unwrap(raw.scientificName) as string | undefined,
		group: unwrap(raw.group) as string | undefined,
		habDepth: unwrap(raw.hab_depth) as string | undefined,
		rangeDepthMin: rangeDepth ? (unwrap(rangeDepth[0]) as number) : undefined,
		rangeDepthMax: rangeDepth ? (unwrap(rangeDepth[1]) as number) : undefined,
		modelDate: unwrap(raw.model_date) as string | undefined,
		nFitPoints: unwrap(raw.model_fit_points) as number | undefined,
		modelGood: unwrap(raw.model_good) as boolean | undefined,
		modelGoodMetric: unwrap(raw.model_good_metric) as string | undefined,
		modelGoodThreshold: unwrap(raw.model_good_threshold) as number | undefined
	};
}

// ── Static model-explanation text (mirrors Shiny's www/context_info.json → models.*) ──

export const MODEL_EXPLANATIONS: Record<string, string> = {
	rf: 'Random Forest builds many decision trees on bootstrapped subsets of the occurrence and background data and averages their votes. It handles non-linear relationships between environmental predictors well and is comparatively robust to overfitting, at the cost of being harder to interpret directly than a single model.',
	maxent:
		'MAXENT (Maximum Entropy) models the species’ environmental niche as the probability distribution of highest entropy consistent with the environmental conditions at known occurrence points. It is well suited to presence-only data and small sample sizes.',
	xgboost:
		'XGBoost is a gradient-boosted tree ensemble: trees are added sequentially, each one correcting the errors of the ones before it. It often achieves high predictive accuracy but needs more careful tuning and a larger amount of data than simpler methods.',
	ensemble:
		'The ensemble prediction combines the outputs of the individual algorithms (typically their mean), aiming for a more stable, less method-dependent estimate of suitability than any single model alone.'
};
