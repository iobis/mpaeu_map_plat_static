/**
 * habitat-catalogue.ts
 *
 * Pure URL builders + option lists for the Habitat tab — mirrors
 * `quarto_components/_habitat.qmd` (6 fixed habitat types, no species
 * selector). Naming convention confirmed against `habitat_db.parquet`'s
 * `files` list-column (mpaeu_map_platform/data/habitat_db.parquet) for
 * `habitat=corals`: 89 rows, one per threshold(2) × post_treatment(2) ×
 * type(2) × scenario/period(11) combo, e.g.
 *   .../sdm/habitat/model=mpaeu/habitat=corals_model=mpaeu_scen=current_th=mss_type=const_what=continuous_cog.tif
 * Two naming quirks worth flagging: the URL's `type=` segment is the
 * parquet's `post_treatment` column (std/const), and the URL's `what=`
 * segment is the parquet's `type` column (binary/continuous) — the two
 * schemas don't share a name for the same axis. `range_min`/`range_max`
 * vary a little per scenario (habitat "suitability" isn't fixed to 0-100
 * like species predictions), so the map reads them live via
 * `fetchTitilerBandStats` rather than a baked-in manifest.
 */

import type { ScenarioCode, PeriodCode } from './species-catalogue.js';

export type HabitatId = 'seagrass' | 'kelp' | 'polychaete_reefs' | 'maerl' | 'corals' | 'bivalves_beds';

export const HABITAT_OPTIONS: { value: HabitatId; label: string }[] = [
	{ value: 'seagrass', label: 'Seagrass' },
	{ value: 'polychaete_reefs', label: 'Polychaete reefs' },
	{ value: 'maerl', label: 'Maerl' },
	{ value: 'kelp', label: 'Kelp' },
	{ value: 'corals', label: 'Corals' },
	{ value: 'bivalves_beds', label: 'Bivalves beds' }
];

export type HabitatThreshold = 'p10' | 'mss';
export const HABITAT_THRESHOLD_OPTIONS: { value: HabitatThreshold; label: string }[] = [
	{ value: 'p10', label: 'P10' },
	{ value: 'mss', label: 'MSS' }
];

export type PostTreatment = 'std' | 'const';
export const POST_TREATMENT_OPTIONS: { value: PostTreatment; label: string }[] = [
	{ value: 'std', label: 'Standard' },
	{ value: 'const', label: 'Constrained' }
];

const S3_HABITAT_BASE = 'https://obis-maps.s3.us-east-1.amazonaws.com/sdm/habitat/model=mpaeu/';

function scenarioSegment(scenario: ScenarioCode, period?: PeriodCode): string {
	return scenario === 'current' ? 'current' : `${scenario}_${period}`;
}

export function habitatUrl(
	habitat: HabitatId,
	scenario: ScenarioCode,
	period: PeriodCode | undefined,
	threshold: HabitatThreshold,
	postTreatment: PostTreatment,
	binary: boolean
): string {
	const scen = scenarioSegment(scenario, period);
	const what = binary ? 'binary' : 'continuous';
	return `${S3_HABITAT_BASE}habitat=${habitat}_model=mpaeu_scen=${scen}_th=${threshold}_type=${postTreatment}_what=${what}_cog.tif`;
}

/** The occurrence points used to fit this habitat's model — `decimalLongitude`/`decimalLatitude`/`species`/`taxonID` columns. Backs the Habitat tab's "Species information" contextual table (distinct species actually contributing to this habitat model). */
export function habitatFitoccUrl(habitat: HabitatId): string {
	return `${S3_HABITAT_BASE}habitat=${habitat}_model=mpaeu_what=fitocc.parquet`;
}
