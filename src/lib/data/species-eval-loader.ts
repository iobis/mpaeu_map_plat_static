/**
 * species-eval-loader.ts
 *
 * Reads a species' `experteval.json` (peer-review status + scores) and
 * derives the same "model quality" bucket the Shiny app computes in
 * `components/tabcontexts.R`'s `contextSpecies` handler: not evaluated at
 * all vs. Good/Average/Poor from the average reviewer score. Backs the
 * "Expert review" / "Model evaluation details" box — see
 * `general_functions.R`'s `gen_context_boxes()` / `evaluation_modal()` for
 * the source this was ported from.
 */

import { unboxRJson } from './species-metrics-loader.js';

export type ModelQuality = 'Good' | 'Average' | 'Poor' | 'Not assessed';

export interface ExpertEvalSummary {
	bestScore?: string;
	bestScoreN?: number;
	cbiScore?: number;
	averageCbi?: number;
	sdCbi?: number;
	bestCbi?: string;
	averageScore?: number;
	evaluators?: string[];
}

export interface ExpertEvalRow {
	Evaluator: string;
	[question: string]: string | number;
}

export interface ExpertEval {
	evaluated: boolean;
	summary: ExpertEvalSummary | null;
	evaluations: ExpertEvalRow[];
	modelQuality: ModelQuality;
}

function toStringArray(v: unknown): string[] | undefined {
	if (v == null) return undefined;
	return Array.isArray(v) ? v.map(String) : [String(v)];
}

export async function loadExpertEval(url: string): Promise<ExpertEval> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to load expert evaluation: ${res.status}`);
	const raw = (await res.json()) as {
		status?: unknown;
		summary?: unknown;
		evaluations?: ExpertEvalRow[] | Record<string, never>;
	};

	// `status` and `summary` are R-scalar-boxed (e.g. `"status": ["not_evaluated"]`)
	// and safe to run through the general unboxer. `evaluations`, though, is a
	// data.frame serialized row-by-row by jsonlite — its rows are never boxed,
	// and it's a genuine list even at length 1 (a single evaluator), so it
	// must NOT go through `unboxRJson`: that helper can't tell "R scalar
	// boxed as a 1-element array" apart from "a real list that has 1 row",
	// and would collapse a single evaluator's row into a bare object,
	// silently dropping it (`Array.isArray` would then be false).
	const status = unboxRJson(raw.status);
	const evaluated = status === 'evaluated';
	const s = evaluated ? (unboxRJson(raw.summary) as Record<string, unknown>) : null;
	const summary: ExpertEvalSummary | null =
		evaluated && s
			? {
					bestScore: s.best_score as string | undefined,
					bestScoreN: s.best_score_n as number | undefined,
					cbiScore: s.cbi_score as number | undefined,
					averageCbi: s.average_cbi as number | undefined,
					sdCbi: s.sd_cbi as number | undefined,
					bestCbi: s.best_cbi as string | undefined,
					averageScore: s.average_score as number | undefined,
					evaluators: toStringArray(s.evaluators)
				}
			: null;

	const evaluations = evaluated && Array.isArray(raw.evaluations) ? raw.evaluations : [];

	let modelQuality: ModelQuality = 'Not assessed';
	if (evaluated && summary?.averageScore != null) {
		modelQuality = summary.averageScore <= 2 ? 'Good' : summary.averageScore <= 4 ? 'Average' : 'Poor';
	}

	return { evaluated, summary, evaluations, modelQuality };
}

// ── Colours — mirror `general_functions.R`'s `gen_context_boxes()` exactly ──

export const MODEL_QUALITY_COLORS: Record<ModelQuality, string> = {
	Good: '#199651',
	Average: '#c18820',
	Poor: '#a51c3c',
	'Not assessed': '#b4b4b4'
};

export const REVIEWED_COLORS = { yes: '#199651', no: '#a51c3c' };

/** `redlistCategory` values seen in `species-index.parquet`: DD/LC/NT/VU/EN/CR/EW/LR/EX/"Not available". Anything not listed falls back to Shiny's own default ("white" — a deliberate no-op for the handful of LR/EX rows). */
export const REDLIST_COLORS: Record<string, string> = {
	'Not available': '#adadad',
	DD: '#727272',
	LC: '#51bc1d',
	NT: '#97c115',
	VU: '#ffc90e',
	EN: '#f28533',
	CR: '#c52412',
	EW: '#85618d'
};

export function redlistColor(category: string): string {
	return REDLIST_COLORS[category] ?? 'white';
}
