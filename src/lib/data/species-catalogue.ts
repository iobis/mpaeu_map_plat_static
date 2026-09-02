/**
 * species-catalogue.ts
 *
 * Pure URL builders for a species' per-taxonID asset files on the
 * production S3 bucket (`obis-maps`), plus the small option lists shared by
 * the Species tab's selectors. The species LIST itself (all 12,039 species
 * with model output) lives in `species-index.parquet` — see
 * `species-index-loader.ts` — not here.
 *
 * The naming convention below was verified against `species_db.parquet`'s
 * own `files` list-column (mpaeu_map_platform/data/species_db.parquet) —
 * not just one demo species. Confirmed empirically, across the *full*
 * 12,039-species dataset (see conversation history):
 *   - every species has exactly the same asset shape: mask/fitocc/log/
 *     thresholds/thermenvelope always exist, and every (species, method) has
 *     the full current + 5-scenario x 2-period prediction grid (11 rows,
 *     never partial).
 *   - the method file-name tag is always the literal method name, except
 *     `rf` which is always tagged `rf_classification_ds` (the down-sampled
 *     classification variant actually fit).
 * So these builders are safe to call for any species in the index, not just
 * ones spot-checked directly — spot-checked 3 more (taxonid=100599 [esm-only],
 * 100614 [ensemble/maxent/rf]) against both S3 and a live titiler tile
 * request to confirm before relying on this.
 */

export type ScenarioCode = 'current' | 'ssp126' | 'ssp245' | 'ssp370' | 'ssp460' | 'ssp585';
export type PeriodCode = 'dec50' | 'dec100';
/** esm only ever appears alone — the fallback for species too data-poor for the full 4-algorithm ensemble. */
export type ModelMethod = 'maxent' | 'rf' | 'xgboost' | 'ensemble' | 'esm';

export const MODEL_LABELS: Record<ModelMethod, string> = {
	maxent: 'MAXENT',
	rf: 'Random Forest',
	xgboost: 'XGBoost',
	ensemble: 'Ensemble',
	esm: 'Ensemble of Small Models'
};

export const SCENARIO_OPTIONS: { value: ScenarioCode; label: string }[] = [
	{ value: 'current', label: 'Current' },
	{ value: 'ssp126', label: 'SSP1' },
	{ value: 'ssp245', label: 'SSP2' },
	{ value: 'ssp370', label: 'SSP3' },
	{ value: 'ssp460', label: 'SSP4' },
	{ value: 'ssp585', label: 'SSP5' }
];

export const PERIOD_OPTIONS: { value: PeriodCode; label: string }[] = [
	{ value: 'dec50', label: '2050' },
	{ value: 'dec100', label: '2100' }
];

/** The 3 "soft threshold" choices exposed as the Filter control (matches the Shiny `ecspBin` widget). */
export type ThresholdMode = 'none' | 'p10' | 'mss' | 'mtp';
export const THRESHOLD_OPTIONS: { value: ThresholdMode; label: string; hint: string }[] = [
	{ value: 'none', label: 'None', hint: 'Show the full suitability gradient, unfiltered.' },
	{
		value: 'p10',
		label: 'P10',
		hint: '10th percentile training presence — floors out the lowest 10% of predicted suitability at occurrence points.'
	},
	{
		value: 'mss',
		label: 'MSS',
		hint: 'Max. sensitivity + specificity — the threshold that best balances false positives/negatives.'
	},
	{
		value: 'mtp',
		label: 'MTP',
		hint: 'Minimum training presence — the lowest suitability value seen at any occurrence point.'
	}
];

const S3_SDM_BASE = 'https://obis-maps.s3.us-east-1.amazonaws.com/sdm/species/';

function speciesBase(taxonID: number): string {
	return `${S3_SDM_BASE}taxonid=${taxonID}/model=mpaeu/`;
}

function methodTag(method: ModelMethod): string {
	return method === 'rf' ? 'rf_classification_ds' : method;
}

function scenarioSegment(scenario: ScenarioCode, period?: PeriodCode): string {
	return scenario === 'current' ? 'current' : `${scenario}_${period}`;
}

export function predictionUrl(
	taxonID: number,
	method: ModelMethod,
	scenario: ScenarioCode,
	period?: PeriodCode,
	variant?: 'bootcv'
): string {
	const scen = scenarioSegment(scenario, period);
	const what = variant ? `_what=${variant}` : '';
	return `${speciesBase(taxonID)}predictions/taxonid=${taxonID}_model=mpaeu_method=${methodTag(method)}_scen=${scen}${what}_cog.tif`;
}

export function maskUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}predictions/taxonid=${taxonID}_model=mpaeu_what=mask_cog.tif`;
}

/** Thermal envelope — 11-band binary (inside/outside envelope) COG, same band order as SCENARIO_PERIOD_COMBOS. Backs the Thermal Range tab. */
export function thermenvelopeUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}predictions/taxonid=${taxonID}_model=mpaeu_what=thermenvelope_cog.tif`;
}

/** Precomputed thermal-range summary stats (quantiles/mean/sd of SST at occurrence points, + area within range) per scenario/period — backs the Thermal Range tab's contextual grid. See thermal-metrics-loader.ts. */
export function thermMetricsUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}metrics/taxonid=${taxonID}_model=mpaeu_what=thermmetrics.json`;
}

export function fitoccUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}taxonid=${taxonID}_model=mpaeu_what=fitocc.parquet`;
}

export function logUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}taxonid=${taxonID}_model=mpaeu_what=log.json`;
}

/** Peer-review status/summary/evaluations — mirrors `components/tabcontexts.R`'s `experteval` file. See species-eval-loader.ts. */
export function expertEvalUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}taxonid=${taxonID}_model=mpaeu_what=experteval.json`;
}

export function metricsUrl(
	taxonID: number,
	method: ModelMethod,
	what: 'cvmetrics' | 'varimportance' | 'respcurves'
): string {
	return `${speciesBase(taxonID)}metrics/taxonid=${taxonID}_model=mpaeu_method=${methodTag(method)}_what=${what}.parquet`;
}

/** Not method-tagged in the file name — one row per method lives inside the file. */
export function thresholdsUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}metrics/taxonid=${taxonID}_model=mpaeu_what=thresholds.parquet`;
}

/** Not method-tagged — one RDS per species, `list(k_stat=<envelope>, l_stat=<envelope>)`. See webr-bias-loader.ts. */
export function biasMetricsUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}metrics/taxonid=${taxonID}_model=mpaeu_what=biasmetrics.rds`;
}

/** Extrapolation-shape statistic (continuous) — multiband, one band per scenario/period (see SCENARIO_PERIOD_COMBOS). */
export function shapeUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}predictions/taxonid=${taxonID}_model=mpaeu_what=shape_cog.tif`;
}

/** MESS extrapolation statistic (small integer categories) — same band layout as shapeUrl(). */
export function messUrl(taxonID: number): string {
	return `${speciesBase(taxonID)}predictions/taxonid=${taxonID}_model=mpaeu_what=mess_cog.tif`;
}

// Flat list of the 11 scenario/period combos shared by every per-species
// multiband raster (predictions, shape, mess) — band order confirmed via a
// live titiler /cog/info request (band_descriptions): current, then each
// SSP x {2050,2100} in SCENARIO_OPTIONS/PERIOD_OPTIONS order.
export interface ScenarioPeriodCombo {
	value: string;
	label: string;
	scenario: ScenarioCode;
	period?: PeriodCode;
	/** 1-indexed band in shape_cog.tif / mess_cog.tif. */
	bandIndex: number;
}

export const SCENARIO_PERIOD_COMBOS: ScenarioPeriodCombo[] = (() => {
	const combos: ScenarioPeriodCombo[] = [{ value: 'current', label: 'Current', scenario: 'current', bandIndex: 1 }];
	let band = 2;
	for (const scenOpt of SCENARIO_OPTIONS) {
		if (scenOpt.value === 'current') continue;
		for (const perOpt of PERIOD_OPTIONS) {
			combos.push({
				value: `${scenOpt.value}_${perOpt.value}`,
				label: `${scenOpt.label} ${perOpt.label}`,
				scenario: scenOpt.value,
				period: perOpt.value,
				bandIndex: band++
			});
		}
	}
	return combos;
})();

// Mirrors layers.ts's MASK_BAND_LABELS (same mask COG, same band order) —
// duplicated here rather than imported so the species module has no
// dependency on the generic demo catalogue.
export const MASK_TYPE_LABELS = [
	'Native ecoregions',
	'Fit ecoregions',
	'Fit region',
	'Fit region (max depth)',
	'Convex hull',
	'Min. bounding circle',
	'Buffer 100m'
];
