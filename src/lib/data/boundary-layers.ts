/**
 * boundary-layers.ts
 *
 * The three context overlays shared across the Species/Thermal Range/Habitat
 * tabs — "Show realms"/"Show EEZs"/"Show MPAs" in `_modelinfo.qmd`.
 *
 * Realms and EEZ are local files the Shiny app reads directly into memory at
 * server start (`components/serverstart.R`: `sf::st_read("data/MarineRealms_BO.shp")`,
 * `sfarrow::st_read_parquet("data/EEZ_IHO_simp_edited.parquet")`) — converted
 * to FlatGeobuf and bundled as static assets here (see
 * `scripts/convert-boundary-layers.R`) since there's no backend to read them
 * from. MPA is already public on S3 in exactly the shape this rewrite's
 * vector-layer config expects, so it's used as-is (confirmed CORS-open).
 *
 * `ecspMPA` has no server-side handler at all in the Shiny app (its tooltip
 * literally says "Not available at this moment") — this rewrite makes it
 * real, using the one populated MPA dataset that already exists (the same
 * "fully/highly protected" layer the Atlas section links to).
 */

import { base } from '$app/paths';

export const REALMS_URL = `${base}/data/realms.fgb`;
export const EEZ_URL = `${base}/data/eez.fgb`;
export const MPA_URL = 'https://mpaeu-sdm.s3.amazonaws.com/atlas/mpaeurope_mpalevelprotection_hf.fgb';

export const MPA_COLOR_MAP: Record<string, string> = { fully: '#1d6fa4', highly: '#2ca25f' };

export const REALMS_ATTRIBUTION = "Costello et al. (2017). Marine ecoregions and provinces, as used in the app's fit-region masks.";
export const EEZ_ATTRIBUTION =
	'Flanders Marine Institute (2020). Exclusive Economic Zones (EEZ) × IHO sea areas intersect, version 4. marineregions.org';
export const MPA_ATTRIBUTION = "Keith et al. (in preparation). Level of protection (fully/highly protected areas), via the MPA Europe atlas.";
