/**
 * thermal-metrics-loader.ts
 *
 * Reads a species' `thermmetrics.json` — mirrors `components/contextualinfo.R`'s
 * thermal branch: quantiles/mean/sd of sea-surface temperature at the
 * species' occurrence points ("limits", one row per scenario/period) and
 * the area (km²) within the thermal envelope for each of those same
 * combos ("areas"). Backs the Thermal Range tab's contextual grid.
 *
 * Not R-scalar-boxed like `log.json`/`experteval.json` — `limits`/`areas`
 * are plain arrays of plain-scalar objects (confirmed against the real
 * file for taxonid=137080), except `sst_depth`, which is a genuine
 * length-1 R vector boxed the usual way. Two real naming-schema quirks
 * worth remembering: `limits` calls the scenario's future timestep
 * `period`, `areas` calls the exact same thing `year` — different key
 * for the same concept between the two arrays in the same file.
 */

export interface ThermLimitRow {
	scenario: string;
	period?: string;
	q05: number;
	q50: number;
	q95: number;
	mean: number;
	sd: number;
}

export interface ThermAreaRow {
	scenario: string;
	period?: string;
	areaKm2: number;
}

export interface ThermMetrics {
	limits: ThermLimitRow[];
	areas: ThermAreaRow[];
	sstDepth: string;
}

export async function loadThermMetrics(url: string): Promise<ThermMetrics> {
	const raw = (await (await fetch(url)).json()) as {
		limits: Record<string, number | string>[];
		areas: Record<string, number | string>[];
		sst_depth: string | string[];
	};

	const limits: ThermLimitRow[] = raw.limits.map((r) => ({
		scenario: r.scenario as string,
		period: r.period as string | undefined,
		q05: r['q_0.05'] as number,
		q50: r['q_0.5'] as number,
		q95: r['q_0.95'] as number,
		mean: r.mean_v as number,
		sd: r.sd_v as number
	}));

	const areas: ThermAreaRow[] = raw.areas.map((r) => ({
		scenario: r.scenario as string,
		period: r.year as string | undefined,
		areaKm2: r.area as number
	}));

	const sstDepth = Array.isArray(raw.sst_depth) ? raw.sst_depth[0] : raw.sst_depth;

	return { limits, areas, sstDepth };
}

const SCENARIO_LABELS: Record<string, string> = {
	current: 'Current',
	ssp126: 'SSP1 (2.6)',
	ssp245: 'SSP2 (4.5)',
	ssp370: 'SSP3 (7.0)',
	ssp460: 'SSP4 (6.0)',
	ssp585: 'SSP5 (8.5)'
};
const PERIOD_LABELS: Record<string, string> = { dec50: '2050', dec100: '2100' };

export function scenarioLabel(scenario: string): string {
	return SCENARIO_LABELS[scenario] ?? scenario;
}
export function periodLabel(period: string | undefined): string {
	return period ? (PERIOD_LABELS[period] ?? period) : '—';
}
