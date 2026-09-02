/**
 * report-data-loader.ts
 *
 * Parses a species' full `log.json` into everything the "Generate report"
 * page needs — mirrors `scripts/map_output_model.qmd`'s "Model details" and
 * "Model post-evaluation" sections in the Shiny app (that Quarto template
 * gets rendered server-side via `quarto::quarto_render()`; this rewrite has
 * no backend, so the exact same fields are read client-side instead and
 * rendered directly as HTML — see routes/report/+page.svelte).
 *
 * Every field here is read from the SAME log.json already used elsewhere
 * (species-metrics-loader.ts's `loadSpeciesLog` only plucks a handful of
 * scalars for the context-info box — this reads the rest: `model_details`,
 * `model_result`, `timings`, `model_posteval`).
 */

import { unboxRJson } from './species-metrics-loader.js';

export interface TimingRow {
	what: string;
	timeMins: number;
}

export interface PostEvalMetrics {
	/** [Q0.05, Q0.95] of the thermal range, or null if not available for this method. */
	thermalRangeQ05: number | null;
	thermalRangeQ95: number | null;
	/** Whether the *first* `thermal_envelope` entry's own status contains "inside" — ported as-is from `verify_posteval()`/the Quarto template, which both key off index 1 unconditionally rather than looking up the "inside_tenv" entry specifically. */
	insideEnvelope: 'Yes' | 'No' | null;
	envelopePercentage: number | null;
	/** Niche overlap metrics — "Not available" when this species has no niche data at all (a real, common case: e.g. `model_posteval.niche` is `{}` for many species) or no entry for the selected method. */
	nicheD: number | 'Not available';
	nicheI: number | 'Not available';
	hyperJaccard: number | 'Not available';
	hyperSorensen: number | 'Not available';
}

export interface ReportData {
	scientificName: string;
	taxonID: number;
	group: string;
	habDepth: string;
	rangeDepthMin: number | null;
	rangeDepthMax: number | null;
	modelDate: string;
	modelAcro: string;
	nInitPoints: number | null;
	modelFitPoints: number | null;
	modelEvalPoints: number | null;
	backgroundSize: number | null;
	/** Raw predictor codes (e.g. "siconc_max") — see humanizeReportVariable() for display labels. */
	variables: string[];
	/** method -> "succeeded" | "failed" | ... , from `model_result`. */
	modelResult: Record<string, string>;
	timings: TimingRow[];
	obissdmVersion: string;
	postEval: PostEvalMetrics;
}

function firstNum(v: unknown): number | null {
	return typeof v === 'number' ? v : null;
}
function firstStr(v: unknown): string {
	return typeof v === 'string' ? v : '';
}

export async function loadReportData(logUrl: string, method: string): Promise<ReportData> {
	const raw = unboxRJson(await (await fetch(logUrl)).json()) as Record<string, any>;

	const modelDetails = (raw.model_details ?? {}) as Record<string, any>;
	const variables: string[] = Array.isArray(modelDetails.variables) ? modelDetails.variables.map((v: unknown) => String(v)) : [];

	const modelResult: Record<string, string> = {};
	if (raw.model_result && typeof raw.model_result === 'object') {
		for (const [k, v] of Object.entries(raw.model_result as Record<string, unknown>)) {
			modelResult[k] = String(v);
		}
	}

	const timings: TimingRow[] = Array.isArray(raw.timings)
		? raw.timings.map((t: any) => ({ what: firstStr(t?.what), timeMins: firstNum(t?.time_mins) ?? 0 }))
		: [];

	const rangeDepth = Array.isArray(raw.range_depth) ? raw.range_depth : null;

	const postEval = parsePostEval(raw.model_posteval, method);

	return {
		scientificName: firstStr(raw.scientificName),
		taxonID: firstNum(raw.taxonID) ?? 0,
		group: firstStr(raw.group),
		habDepth: firstStr(raw.hab_depth),
		rangeDepthMin: rangeDepth ? firstNum(rangeDepth[0]) : null,
		rangeDepthMax: rangeDepth ? firstNum(rangeDepth[1]) : null,
		modelDate: firstStr(raw.model_date),
		modelAcro: firstStr(raw.model_acro),
		nInitPoints: firstNum(raw.n_init_points),
		modelFitPoints: firstNum(raw.model_fit_points),
		modelEvalPoints: firstNum(raw.model_eval_points),
		backgroundSize: firstNum(modelDetails.background_size),
		variables,
		modelResult,
		timings,
		obissdmVersion: firstStr(raw.obissdm_version),
		postEval
	};
}

function parsePostEval(modelPosteval: unknown, method: string): PostEvalMetrics {
	const empty: PostEvalMetrics = {
		thermalRangeQ05: null,
		thermalRangeQ95: null,
		insideEnvelope: null,
		envelopePercentage: null,
		nicheD: 'Not available',
		nicheI: 'Not available',
		hyperJaccard: 'Not available',
		hyperSorensen: 'Not available'
	};
	if (!modelPosteval || typeof modelPosteval !== 'object') return empty;
	const pe = modelPosteval as Record<string, any>;

	// The Shiny app substitutes rf/maxnet method aliases before indexing
	// `model_posteval` (map_output_model.qmd's "Model post-evaluation" setup
	// chunk) — same substitution here, since `model_posteval`'s own keys use
	// those names, not "rf_classification_ds"/"maxent".
	const key = method === 'rf' ? 'rf' : method === 'maxent' ? 'maxent' : method;
	const methodEval = pe[key] as Record<string, any> | undefined;

	let thermalRangeQ05: number | null = null;
	let thermalRangeQ95: number | null = null;
	let insideEnvelope: 'Yes' | 'No' | null = null;
	let envelopePercentage: number | null = null;

	if (methodEval) {
		const tr = methodEval.thermal_range;
		if (Array.isArray(tr) && tr.length >= 4) {
			thermalRangeQ05 = firstNum(tr[1]);
			thermalRangeQ95 = firstNum(tr[3]);
		}
		const envArr = methodEval.thermal_envelope;
		if (Array.isArray(envArr) && envArr.length > 0) {
			const first = envArr[0];
			const status = firstStr(first?.status);
			insideEnvelope = status.includes('inside') ? 'Yes' : 'No';
			envelopePercentage = firstNum(first?.percentage);
		}
	}

	// niche / hyperniche are arrays of {model, ...} rows (same shape), or an
	// empty object `{}` when nothing was computed for this species at all.
	const niche = Array.isArray(pe.niche) ? (pe.niche as Record<string, any>[]) : [];
	const hyperniche = Array.isArray(pe.hyperniche) ? (pe.hyperniche as Record<string, any>[]) : [];
	const nicheRow = niche.find((r) => firstStr(r?.model) === key);
	const hyperRow = hyperniche.find((r) => firstStr(r?.model) === key);

	const nicheD = nicheRow ? (firstNum(nicheRow.D) ?? 'Not available') : 'Not available';
	// The Quarto template reads `$D` for both D and I (I_m) — almost
	// certainly a copy/paste slip there, not a real "I equals D" result, so
	// this reads the actual `I` field when present and only falls back to
	// mirroring the original's behaviour (same value as D) if there truly
	// isn't a separate `I` field to read.
	const nicheI = nicheRow ? (firstNum(nicheRow.I) ?? (typeof nicheD === 'number' ? nicheD : 'Not available')) : 'Not available';
	const hyperJaccard = hyperRow ? (firstNum(hyperRow.hyperniche_jaccard) ?? 'Not available') : 'Not available';
	const hyperSorensen = hyperRow ? (firstNum(hyperRow.hyperniche_sorensen) ?? 'Not available') : 'Not available';

	return { thermalRangeQ05, thermalRangeQ95, insideEnvelope, envelopePercentage, nicheD, nicheI, hyperJaccard, hyperSorensen };
}

// ── Predictor variable labels — mirrors map_output_model.qmd's `dplyr::case_when` ──
// First substring match wins; unmatched codes are shown as-is. Order matches the
// source exactly (including its harmless duplicate `thetao` branch).
const VARIABLE_LABEL_RULES: [string, string][] = [
	['tas', 'Air temperature'],
	['siconc', 'Sea Ice'],
	['thetao', 'SST'],
	['bathy', 'Bathymetry'],
	['dist', 'Distance to coast'],
	['sws', 'Sea water speed'],
	['wave', 'Wave Fetch'],
	['so', 'Salinity'],
	['o2', 'Oxygen'],
	['par', 'PAR'],
	['rugo', 'Rugosity']
];

export function humanizeReportVariable(code: string): string {
	for (const [substr, label] of VARIABLE_LABEL_RULES) {
		if (code.includes(substr)) return `${label} (${code})`;
	}
	return code;
}
