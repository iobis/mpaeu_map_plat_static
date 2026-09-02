import type { ColormapName } from '@developmentseed/deck.gl-raster/gpu-modules';

// ── Layer config shape ────────────────────────────────────────────────────────

export type LayerScale = 'continuous' | 'categorical' | 'rgb';
export type LayerType = 'raster' | 'vector-point' | 'vector-polygon' | 'vector-line' | 'table-point';

/** Named flat-fill colours offered for single-value rasters (see LayerConfig.isSingleValue) */
export type SingleColorName = 'blue' | 'yellow' | 'red' | 'purple';
export const SINGLE_COLOR_NAMES: SingleColorName[] = ['blue', 'yellow', 'red', 'purple'];
export const SINGLE_COLOR_HEX: Record<SingleColorName, string> = {
	blue: '#1d6fa4',
	yellow: '#f0a500',
	red: '#dc2626',
	purple: '#8856a7'
};

export interface LayerConfig {
	id: string; // stable unique key
	name: string;
	category: string;
	type: LayerType;
	scale: LayerScale;
	url: string;
	source: string;
	link?: string;
	description: string;
	/** Suggested data range for continuous rasters */
	dataMin?: number;
	dataMax?: number;
	dataDivider?: number;
	/** Default colormap name */
	colormap?: ColormapName;
	/**
	 * For categorical vector layers: the feature property to colour by.
	 * e.g. 'region', 'habitat_type'
	 */
	categoryField?: string;
	/**
	 * Explicit colour map for categorical values: { value: '#hexcolor' }.
	 * If omitted, colours are auto-assigned from a built-in palette.
	 */
	colorMap?: Record<string, string>;
	/** True if this raster's GeoTIFF stores multiple selectable bands (e.g. depth slices) */
	isMultiband?: boolean;
	/** Label for the band dimension, e.g. "Depths" */
	multiBandName?: string;
	/** Display label per band, in band order (index = band index) */
	bandLabels?: string[];
	/**
	 * True for rasters with a degenerate value range (dataMin === dataMax, e.g.
	 * binary presence masks): rendered as one flat, user-selectable colour
	 * instead of a gradient, since a zero-width LinearRescale range otherwise
	 * always samples the palest end of the colormap.
	 */
	isSingleValue?: boolean;
	/** Legend label for a single-value raster, e.g. "Priority area". Defaults to the colour name. */
	singleValueLabel?: string;
	/**
	 * URL of a companion mask COG (multiband, one band per mask definition,
	 * binary 0/1 per pixel) rendered as a separate layer stacked directly
	 * above this one. Mirrors the current Shiny app's mask semantics: value 0
	 * ("outside" the mask) is painted grey, value 1 ("inside") is transparent
	 * so the data below shows through unmodified.
	 */
	maskUrl?: string;
	/** Display label per mask band, in band order (index = band index) */
	maskBandLabels?: string[];
	/** Default selected mask band index. @default 0 */
	maskDefaultBandIndex?: number;
	/** For table-point layers: the parquet column holding longitude */
	lonField?: string;
	/** For table-point layers: the parquet column holding latitude */
	latField?: string;
}

// ── Phase-1 demo catalogue ─────────────────────────────────────────────────────
// A small set of REAL layers from the public obis-maps / mpaeu-sdm S3 buckets,
// used to exercise every layer kind end-to-end (raster + mask, point, vector
// polygon, and two rasters for compare mode). Species = Amphiura (Amphiura)
// incana, taxonid=243036 (chosen via the local STAC catalog sync in
// mpaeu_map_platform/stac/ — confirmed publicly reachable, full-world 7200x3600
// COGs that overhang +-180 degrees by ~6e-6 degrees, a real antimeridian test case).

const SPECIES_BASE =
	'https://obis-maps.s3.us-east-1.amazonaws.com/sdm/species/taxonid=243036/model=mpaeu/';

const MASK_BAND_LABELS = [
	'Native ecoregions',
	'Fit ecoregions',
	'Fit region',
	'Fit region (max depth)',
	'Convex hull',
	'Min. bounding circle',
	'Buffer 100m'
];

export const LAYER_CATALOGUE: LayerConfig[] = [
	{
		id: 'amphiura_incana_current',
		name: 'Amphiura incana — prediction (current)',
		category: 'Species predictions',
		type: 'raster',
		scale: 'continuous',
		url: SPECIES_BASE + 'predictions/taxonid=243036_model=mpaeu_method=rf_classification_ds_scen=current_cog.tif',
		source: 'MPA Europe SDM',
		link: 'https://shiny.obis.org/distmaps/',
		description: 'Random Forest (down-sampled classification) relative occurrence probability, current conditions.',
		dataMin: 0,
		dataMax: 100,
		dataDivider: 1,
		colormap: 'blues',
		maskUrl: SPECIES_BASE + 'predictions/taxonid=243036_model=mpaeu_what=mask_cog.tif',
		maskBandLabels: MASK_BAND_LABELS,
		maskDefaultBandIndex: 2
	},
	{
		id: 'amphiura_incana_ssp126_2100',
		name: 'Amphiura incana — prediction (SSP1-2.6, 2100)',
		category: 'Species predictions',
		type: 'raster',
		scale: 'continuous',
		url: SPECIES_BASE + 'predictions/taxonid=243036_model=mpaeu_method=rf_classification_ds_scen=ssp126_dec100_cog.tif',
		source: 'MPA Europe SDM',
		link: 'https://shiny.obis.org/distmaps/',
		description: 'Random Forest (down-sampled classification) relative occurrence probability, SSP1-2.6 scenario, 2100.',
		dataMin: 0,
		dataMax: 100,
		dataDivider: 1,
		colormap: 'blues',
		maskUrl: SPECIES_BASE + 'predictions/taxonid=243036_model=mpaeu_what=mask_cog.tif',
		maskBandLabels: MASK_BAND_LABELS,
		maskDefaultBandIndex: 2
	},
	{
		id: 'amphiura_incana_fitocc',
		name: 'Amphiura incana — occurrence points used to fit the model',
		category: 'Species predictions',
		type: 'table-point',
		scale: 'categorical',
		url: SPECIES_BASE + 'taxonid=243036_model=mpaeu_what=fitocc.parquet',
		source: 'MPA Europe SDM / OBIS',
		description: 'Occurrence records used to fit the current species distribution model.',
		lonField: 'decimalLongitude',
		latField: 'decimalLatitude'
	},
	{
		id: 'mpa_europe_regions',
		name: 'MPA Europe regions',
		category: 'Context layers',
		type: 'vector-polygon',
		scale: 'categorical',
		url: 'https://mpaeu-sdm.s3.amazonaws.com/atlas/sea_basins.fgb',
		source:
			'MPA Europe (modified from Flanders Marine Institute (2024). Union of the ESRI Country shapefile and the Exclusive Economic Zones (version 4). Available online at https://www.marineregions.org/. https://doi.org/10.14284/698.)',
		link: 'https://doi.org/10.14284/698',
		description: 'MPA Europe marine regions',
		categoryField: 'region',
		colorMap: {
			Atlantic: '#1d6fa4',
			Baltic: '#2ca25f',
			'Black Sea': '#8856a7',
			Mediterranean: '#f0a500'
		}
	}
];
