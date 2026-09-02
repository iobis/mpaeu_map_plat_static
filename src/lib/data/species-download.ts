/**
 * species-download.ts
 *
 * Client-side stand-in for the Shiny app's `components/downloads.R` +
 * `scripts/download_handlers_species.R` species-data-download flow, and for
 * `scripts/create_local_fit_file.R`'s "run the model" code download. There
 * is no backend here — no `curl::multi_download()` + `zip::zip()` running
 * server-side — so both happen in the browser instead.
 *
 * The per-species file list itself is fetched live from S3, not guessed:
 * the `obis-maps` bucket allows anonymous `ListObjectsV2` and is CORS-open
 * (`Access-Control-Allow-Origin: *`, confirmed empirically), so
 * `listSpeciesFiles()` below asks S3 directly with `?list-type=2&prefix=…`
 * — same source of truth `species_db.parquet`'s `files` column was itself
 * built from, but always current and with real byte sizes, no separate
 * manifest asset to build or keep in sync.
 */

import { base } from '$app/paths';
import { zipSync, type Zippable } from 'fflate';
import type { ModelMethod, ScenarioCode, PeriodCode } from './species-catalogue.js';

const S3_BUCKET_ROOT = 'https://obis-maps.s3.us-east-1.amazonaws.com/';
const S3_SDM_PREFIX = 'sdm/species/';

export interface S3FileEntry {
	/** Full object key, e.g. `sdm/species/taxonid=100599/model=mpaeu/taxonid=100599_model=mpaeu_what=log.json`. */
	key: string;
	url: string;
	size: number;
}

/** Live `ListObjectsV2` against the public bucket — paginates if a species ever exceeds 1000 objects (none currently do). */
export async function listSpeciesFiles(taxonID: number): Promise<S3FileEntry[]> {
	const prefix = `${S3_SDM_PREFIX}taxonid=${taxonID}/`;
	const out: S3FileEntry[] = [];
	let continuationToken: string | undefined;
	do {
		const params = new URLSearchParams({ 'list-type': '2', prefix, 'max-keys': '1000' });
		if (continuationToken) params.set('continuation-token', continuationToken);
		const res = await fetch(`${S3_BUCKET_ROOT}?${params.toString()}`);
		if (!res.ok) throw new Error(`Failed to list files for taxonID ${taxonID}: ${res.status}`);
		const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
		for (const el of xml.getElementsByTagName('Contents')) {
			const key = el.getElementsByTagName('Key')[0]?.textContent ?? '';
			const size = Number(el.getElementsByTagName('Size')[0]?.textContent ?? '0');
			if (key) out.push({ key, url: `${S3_BUCKET_ROOT}${key}`, size });
		}
		const truncated = xml.getElementsByTagName('IsTruncated')[0]?.textContent === 'true';
		continuationToken = truncated ? (xml.getElementsByTagName('NextContinuationToken')[0]?.textContent ?? undefined) : undefined;
	} while (continuationToken);
	return out;
}

function methodTag(method: ModelMethod): string {
	return method === 'rf' ? 'rf_classification_ds' : method;
}

/**
 * Ported from `download_handlers_species.R`: the prediction + uncertainty
 * raster for the exact selected method/scenario/period, plus the
 * *ensemble*'s own cvmetrics/respcurves/varimportance (not the selected
 * model's — that's what the R code actually pulls, `method == "ensemble"`
 * unconditionally, so this mirrors it rather than "fixing" it). Filename
 * matching, not a `type`/`method` column, since the live S3 listing only
 * gives keys — the same naming convention `species-catalogue.ts`'s URL
 * builders rely on.
 */
export function selectedDownloadFiles(files: S3FileEntry[], method: ModelMethod, scenario: ScenarioCode, period?: PeriodCode): S3FileEntry[] {
	const scen = scenario === 'current' ? 'current' : `${scenario}_${period}`;
	const predMarker = `_method=${methodTag(method)}_scen=${scen}`;
	const predFiles = files.filter((f) => f.key.includes(predMarker) && f.key.endsWith('_cog.tif'));

	const ensembleMetricTypes = ['cvmetrics', 'respcurves', 'varimportance'];
	const ensembleFiles = files.filter((f) => ensembleMetricTypes.some((t) => f.key.includes(`_method=ensemble_what=${t}.parquet`)));

	return [...predFiles, ...ensembleFiles];
}

export function totalSize(files: S3FileEntry[]): number {
	return files.reduce((sum, f) => sum + f.size, 0);
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB'];
	let v = bytes / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/** Fetches every file (bounded concurrency) and zips them in-memory preserving their S3 folder structure, then triggers a browser download. */
export async function downloadFilesAsZip(files: S3FileEntry[], zipFilename: string, onProgress?: (done: number, total: number) => void): Promise<void> {
	const entries: Zippable = {};
	let done = 0;
	const concurrency = 6;
	let cursor = 0;

	async function worker() {
		while (cursor < files.length) {
			const f = files[cursor++];
			const res = await fetch(f.url);
			if (!res.ok) {
				console.warn(`[species-download] Skipping ${f.url}: ${res.status}`);
				done++;
				onProgress?.(done, files.length);
				continue;
			}
			const buf = new Uint8Array(await res.arrayBuffer());
			const zipPath = f.key.startsWith(S3_SDM_PREFIX) ? f.key.slice(S3_SDM_PREFIX.length) : f.key;
			entries[zipPath] = buf;
			done++;
			onProgress?.(done, files.length);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));

	const zipped = zipSync(entries, { level: 6 });
	triggerBlobDownload(new Blob([zipped as BlobPart], { type: 'application/zip' }), zipFilename);
}

export function downloadUrlManifest(files: S3FileEntry[], manifestFilename: string): void {
	const text = files.map((f) => f.url).join('\n') + '\n';
	triggerBlobDownload(new Blob([text], { type: 'text/plain' }), manifestFilename);
}

/**
 * Fetches a single remote file and saves it under `filename` — used by the
 * Thermal Range and Habitat tabs' single-file "Download the data" links
 * (Shiny's `downloadLink`s for those two tabs write one COG straight
 * through; a plain `<a download>` doesn't force a save for a *cross-origin*
 * URL like these S3 links, so this fetches it as a blob first).
 */
export async function downloadRemoteFile(url: string, filename: string): Promise<void> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
	const buf = await res.arrayBuffer();
	triggerBlobDownload(new Blob([buf], { type: 'image/tiff' }), filename);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── "Run the model" — local-fit code template (ipynb / qmd) ────────────────
// Ported from `scripts/create_local_fit_file.R`'s `get_local_file()`: fetch
// the template, substitute the 4 placeholders, hand back the filled text.

const ALGO_PACKAGE: Record<ModelMethod, string> = {
	rf: 'RandomForest',
	maxent: 'maxnet',
	xgboost: 'xgboost',
	ensemble: 'maxnet',
	esm: 'maxnet'
};

export async function buildLocalFitFile(
	species: string,
	taxonID: number,
	method: ModelMethod,
	type: 'ipynb' | 'qmd'
): Promise<{ filename: string; content: string }> {
	const templateUrl = `${base}/templates/fit_locally_model.${type}`;
	const source = await (await fetch(templateUrl)).text();
	const content = source
		.replaceAll('SPECIES_NAME', species)
		.replaceAll('APHIA_ID', String(taxonID))
		.replaceAll('ALGO_NAME', method)
		.replaceAll('ALGO_PACKAGE', ALGO_PACKAGE[method]);
	return { filename: `taxonid=${taxonID}_modelcode.${type}`, content };
}

export function downloadTextFile(filename: string, content: string): void {
	triggerBlobDownload(new Blob([content], { type: 'text/plain' }), filename);
}
