/**
 * habitat-species-loader.ts
 *
 * Backs the Habitat tab's "Species information" contextual table — mirrors
 * `components/contextualinfo.R`'s habitat branch (`hab_sel_species`): the
 * distinct species whose occurrence records actually went into fitting
 * this habitat's model, enriched with taxonomy/conservation-status columns.
 *
 * The Shiny app gets this by filtering `speciesinfo` on
 * `AphiaID %in% habitatpts()$taxonID` (a separately-loaded points table);
 * here it's the same idea but simpler — the habitat's own `fitocc.parquet`
 * already carries both `species` (scientific name) and `taxonID` per row,
 * so the distinct-species step needs no join at all. Only the taxonomy/
 * conservation-status *enrichment* joins against the already-loaded
 * `species-index.parquet` (see species-index-loader.ts) — reused here
 * rather than fetched again, since `loadSpeciesIndex()` is cached at module
 * scope.
 *
 * Columns shown are whatever both sources actually carry — the Shiny
 * table also has kingdom/genus/authority/GBIF speciesKey, none of which
 * exist in `species-index.parquet` (deliberately kept minimal in Phase 3),
 * so those are left out rather than guessed.
 */

import { parquetReadObjects } from 'hyparquet';
import { fetchParquetBuffer } from './parquet-fetch.js';
import { loadSpeciesIndex, type SpeciesIndexRow } from './species-index-loader.js';

export interface HabitatSpeciesRow {
	taxonID: number;
	scientificName: string;
	group: string | null;
	phylum: string | null;
	class: string | null;
	order: string | null;
	family: string | null;
	redlistCategory: string | null;
	regionNames: string[];
}

export async function loadHabitatSpecies(fitoccUrl: string): Promise<HabitatSpeciesRow[]> {
	const file = await fetchParquetBuffer(fitoccUrl);
	const rows = (await parquetReadObjects({ file })) as { species: string; taxonID: number }[];

	const distinct = new Map<number, string>();
	for (const r of rows) if (!distinct.has(r.taxonID)) distinct.set(r.taxonID, r.species);

	const index = await loadSpeciesIndex();
	const byTaxonID = new Map<number, SpeciesIndexRow>(index.map((r) => [r.taxonID, r]));

	return [...distinct.entries()]
		.map(([taxonID, scientificName]) => {
			const meta = byTaxonID.get(taxonID);
			return {
				taxonID,
				scientificName,
				group: meta?.group ?? null,
				phylum: meta?.phylum ?? null,
				class: meta?.class ?? null,
				order: meta?.order ?? null,
				family: meta?.family ?? null,
				redlistCategory: meta?.redlistCategory ?? null,
				regionNames: meta?.regionNames ?? []
			};
		})
		.sort((a, b) => a.scientificName.localeCompare(b.scientificName));
}
