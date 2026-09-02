<script lang="ts">
	/**
	 * The real app shell — structured after the original Shiny app
	 * (mpaeu_map_platform): a map (left) + tabbed control panel (right) row,
	 * then a shared control strip and a contextual-results grid below it.
	 * Restyled with the Atlas app's single-primary-colour palette rather than
	 * Shiny's per-tab colour scheme.
	 *
	 * Species / Thermal Range / Habitat are all wired up; "Atlas for MSP" is
	 * deliberately not a tab at all in this rewrite — the Shiny app's own
	 * atlas view lives at a separate, already-public site
	 * (atlas.mpa-europe.eu), so TabBar renders it as a plain external link
	 * rather than an internal panel. Unlike the Phase 1 demo (now at /demo),
	 * only one species/habitat renders at a time here — no layer stack, no
	 * z-order to manage.
	 */
	import { Map, CompareMap, RasterLayer, DeckOverlay, fetchTitilerBandStats, linearColormap } from '$lib/components/maplibre/index.js';
	import type { OverlayEntry } from '$lib/components/maplibre/DeckOverlay.svelte';
	import ColormapLegend from '$lib/components/ColormapLegend.svelte';
	import TabBar from '$lib/components/species/TabBar.svelte';
	import SpeciesTab from '$lib/components/species/SpeciesTab.svelte';
	import ThermalTab from '$lib/components/species/ThermalTab.svelte';
	import HabitatTab from '$lib/components/species/HabitatTab.svelte';
	import ExtraControls from '$lib/components/species/ExtraControls.svelte';
	import ResultsGrid from '$lib/components/species/ResultsGrid.svelte';
	import AdditionalDetails from '$lib/components/species/AdditionalDetails.svelte';
	import ThermalResultsGrid from '$lib/components/species/ThermalResultsGrid.svelte';
	import HabitatResultsGrid from '$lib/components/species/HabitatResultsGrid.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import {
		predictionUrl,
		maskUrl,
		fitoccUrl,
		thermenvelopeUrl,
		SCENARIO_PERIOD_COMBOS,
		SCENARIO_OPTIONS,
		PERIOD_OPTIONS
	} from '$lib/data/species-catalogue.js';
	import { habitatUrl } from '$lib/data/habitat-catalogue.js';
	import { REALMS_URL, EEZ_URL, MPA_URL, MPA_COLOR_MAP } from '$lib/data/boundary-layers.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';
	import { thermalView } from '$lib/stores/thermalView.svelte.js';
	import { habitatView } from '$lib/stores/habitatView.svelte.js';
	import { mapOverlaysView } from '$lib/stores/mapOverlaysView.svelte.js';
	import { PUBLIC_TITILER_URL } from '$env/static/public';

	type TabId = 'species' | 'thermal' | 'habitat';
	let activeTab = $state<TabId>('species');

	const TABS = [
		{ id: 'species', label: 'Species', enabled: true },
		{ id: 'thermal', label: 'Thermal range', enabled: true },
		{ id: 'habitat', label: 'Habitat', enabled: true },
		{ id: 'atlas', label: 'Atlas for MSP', enabled: true, href: 'https://atlas.mpa-europe.eu/' }
	];

	// ── Thermal Range ────────────────────────────────────────────────────────
	// Same 11-band layout as species predictions/SHAPE/MESS (current + 5 SSP
	// x 2 periods) — the envelope is a binary inside/outside-range raster,
	// rendered as Shiny's own 2-colour `binary_palette` gradient rather than
	// a continuous colormap (see general_functions.R's `add_layer_sp`).
	const THERMAL_MASK_BAND_INDEX = 2; // "Fit region" — same default as speciesView, no selector shown for this tab (matches Shiny)

	const thermCombo = $derived(
		SCENARIO_PERIOD_COMBOS.find((c) => c.scenario === thermalView.scenario && (thermalView.scenario === 'current' || c.period === thermalView.period)) ??
			SCENARIO_PERIOD_COMBOS[0]
	);
	const thermUrl = $derived(thermalView.species ? thermenvelopeUrl(thermalView.species.taxonID) : null);
	const thermMaskUrl = $derived(thermalView.species ? maskUrl(thermalView.species.taxonID) : null);
	const showThermMask = $derived(!!thermMaskUrl && thermalView.maskVisible);
	const THERMAL_COLORMAP = linearColormap(0, 1, '#f7fbff', '#08519c');

	// ── Habitat ──────────────────────────────────────────────────────────────
	// Suitability isn't fixed to a 0-100 scale like species predictions, and
	// varies a little per scenario/post-treatment/threshold — read live via
	// titiler's /cog/statistics rather than a baked-in manifest (same idea as
	// the Species tab's SHAPE preview in AdditionalDetails.svelte). The
	// Shiny app renders every habitat variant (binary or continuous file)
	// with the same PuRd gradient — `habitatBinaryFull` only swaps which COG
	// loads, not the colour scheme (confirmed: `add_layer_hab` never
	// references `binary_palette`).
	const habitatUrlValue = $derived.by(() => {
		if (!habitatView.habitat) return null;
		return habitatUrl(habitatView.habitat, habitatView.scenario, habitatView.period, habitatView.threshold, habitatView.postTreatment, habitatView.binary);
	});

	let habitatStats = $state<{ min: number; max: number } | null>(null);
	let habitatStatsKey = '';
	$effect(() => {
		const url = habitatUrlValue;
		if (!url) {
			habitatStats = null;
			habitatStatsKey = '';
			return;
		}
		if (habitatStatsKey === url) return;
		habitatStatsKey = url;
		habitatStats = null;
		fetchTitilerBandStats(PUBLIC_TITILER_URL, url, 1)
			.then((s) => (habitatStats = s))
			.catch((e) => console.error('[+page] Failed to load habitat statistics:', e));
	});

	const predUrl = $derived.by(() => {
		const sp = speciesView.species;
		const method = speciesView.method;
		if (!sp || !method) return null;
		return predictionUrl(sp.taxonID, method, speciesView.scenario, speciesView.period, speciesView.showUncertainty ? 'bootcv' : undefined);
	});

	const predDataMin = $derived.by(() => {
		if (speciesView.showUncertainty) return 0;
		const t = speciesView.thresholds;
		if (!t || speciesView.thresholdMode === 'none') return 0;
		const frac = speciesView.thresholdMode === 'p10' ? t.p10 : speciesView.thresholdMode === 'mtp' ? t.mtp : t.max_spec_sens;
		return Math.round(frac * 100);
	});

	const predColormap = $derived(speciesView.showUncertainty ? 'oranges' : 'blues');

	const maskUrlValue = $derived(speciesView.species ? maskUrl(speciesView.species.taxonID) : null);
	const showMask = $derived(!!maskUrlValue && speciesView.maskVisible);

	const fitoccUrlValue = $derived(speciesView.species ? fitoccUrl(speciesView.species.taxonID) : null);

	// ── Split map viewer (compare mode) ─────────────────────────────────────
	// "Current" vs. the selected future scenario/period, side by side — ported
	// from the Shiny app's `sideSelect` checkbox (species/thermal tabs only;
	// the Shiny app never offered this for Habitat, which has no single
	// "current" baseline the same way). Reuses CompareMap.svelte (built in an
	// earlier phase for the /compare demo route) rather than a new mechanism.
	const speciesCurrentUrl = $derived.by(() => {
		const sp = speciesView.species;
		const method = speciesView.method;
		if (!sp || !method) return null;
		return predictionUrl(sp.taxonID, method, 'current', undefined, speciesView.showUncertainty ? 'bootcv' : undefined);
	});
	const THERMAL_CURRENT_BAND_INDEX = SCENARIO_PERIOD_COMBOS.find((c) => c.scenario === 'current')!.bandIndex - 1;

	const showCompareToggle = $derived(
		(activeTab === 'species' && !!speciesView.species && speciesView.scenario !== 'current') ||
			(activeTab === 'thermal' && !!thermalView.species && thermalView.scenario !== 'current')
	);
	const compareMode = $derived(activeTab === 'species' ? speciesView.compareMode : activeTab === 'thermal' ? thermalView.compareMode : false);
	const compareActive = $derived(
		showCompareToggle && compareMode && !!(activeTab === 'species' ? predUrl && speciesCurrentUrl : thermUrl)
	);
	function toggleCompareMode(checked: boolean) {
		if (activeTab === 'species') speciesView.compareMode = checked;
		else if (activeTab === 'thermal') thermalView.compareMode = checked;
	}
	const compareFutureLabel = $derived.by(() => {
		const scenario = activeTab === 'species' ? speciesView.scenario : activeTab === 'thermal' ? thermalView.scenario : 'current';
		const period = activeTab === 'species' ? speciesView.period : activeTab === 'thermal' ? thermalView.period : 'dec50';
		const opt = SCENARIO_OPTIONS.find((o) => o.value === scenario);
		const per = PERIOD_OPTIONS.find((p) => p.value === period);
		return opt && per ? `${opt.label} · ${per.label}` : 'Future';
	});

	// ── Realms / EEZ / MPA ───────────────────────────────────────────────────
	// Shared across all three tabs (see mapOverlaysView.svelte.ts). Realms and
	// EEZ mirror the Shiny app's `leaflet::addPolygons()` styling exactly —
	// near-invisible fill (`fillOpacity: 0.05`) with a much more visible
	// outline (`opacity: 0.3`) — a bigger fill:line gap than this builder's
	// default 2:1 ratio, hence the explicit `opacity: 1` + factor overrides
	// below rather than just a plain `opacity` prop. MPA has no Shiny
	// equivalent to match (`ecspMPA` was a non-functional stub there — see
	// boundary-layers.ts) so it's styled instead like a normal Atlas
	// category layer: a visible categorical fill, not a boundary line.
	const overlayEntries = $derived.by<OverlayEntry[]>(() => {
		const entries: OverlayEntry[] = [];
		if (mapOverlaysView.showRealms) {
			entries.push({
				layerKind: 'vector',
				zIndex: 0,
				id: 'realms',
				url: REALMS_URL,
				geomKind: 'geojson-polygon',
				opacity: 1,
				fillOpacityFactor: 0.05,
				lineOpacityFactor: 0.3,
				fillColor: '#e9c46a',
				lineColor: '#454545',
				visible: true
			});
		}
		if (mapOverlaysView.showEEZ) {
			entries.push({
				layerKind: 'vector',
				zIndex: 1,
				id: 'eez',
				url: EEZ_URL,
				geomKind: 'geojson-polygon',
				opacity: 1,
				fillOpacityFactor: 0.05,
				lineOpacityFactor: 0.3,
				fillColor: '#0d7edb',
				lineColor: '#454545',
				visible: true
			});
		}
		if (mapOverlaysView.showMPA) {
			entries.push({
				layerKind: 'vector',
				zIndex: 2,
				id: 'mpa',
				url: MPA_URL,
				geomKind: 'geojson-polygon',
				opacity: 0.6,
				categoryField: 'MPA_class',
				colorMap: MPA_COLOR_MAP,
				visible: true
			});
		}
		if (activeTab === 'species' && speciesView.showOccurrencePoints && fitoccUrlValue) {
			entries.push({
				layerKind: 'table',
				zIndex: 10,
				id: 'species-points',
				url: fitoccUrlValue,
				lonField: 'decimalLongitude',
				latField: 'decimalLatitude',
				opacity: 0.9,
				visible: true,
				color: '#111827'
			});
		}
		return entries;
	});
</script>

<svelte:head><title>MPA Europe — SDM Maps</title></svelte:head>

<div class="app-shell">
	<div class="top-row">
		<div class="map-col">
			{#snippet speciesLayer(which: 'current' | 'selected')}
				{@const url = which === 'current' ? speciesCurrentUrl : predUrl}
				{#if url}
					<RasterLayer
						id="species-prediction"
						{url}
						titilerBaseUrl={PUBLIC_TITILER_URL}
						opacity={1}
						visible={true}
						colormap={predColormap}
						dataMin={predDataMin}
						dataMax={100}
						beforeId={showMask ? 'species-mask' : undefined}
					/>
				{/if}
				{#if showMask && maskUrlValue}
					<RasterLayer
						id="species-mask"
						url={maskUrlValue}
						titilerBaseUrl={PUBLIC_TITILER_URL}
						bandIndex={speciesView.maskBandIndex}
						opacity={1}
						visible={true}
						maskMode={true}
						maskColor="#d4dadc"
						maskThreshold={0.5}
						dataMin={0}
						dataMax={1}
					/>
				{/if}
			{/snippet}

			{#snippet thermalLayer(which: 'current' | 'selected')}
				{@const bandIndex = which === 'current' ? THERMAL_CURRENT_BAND_INDEX : thermCombo.bandIndex - 1}
				{#if thermUrl}
					<RasterLayer
						id="thermal-envelope"
						url={thermUrl}
						titilerBaseUrl={PUBLIC_TITILER_URL}
						{bandIndex}
						opacity={1}
						visible={true}
						discreteColormap={THERMAL_COLORMAP}
						beforeId={showThermMask ? 'thermal-mask' : undefined}
					/>
				{/if}
				{#if showThermMask && thermMaskUrl}
					<RasterLayer
						id="thermal-mask"
						url={thermMaskUrl}
						titilerBaseUrl={PUBLIC_TITILER_URL}
						bandIndex={THERMAL_MASK_BAND_INDEX}
						opacity={1}
						visible={true}
						maskMode={true}
						maskColor="#d4dadc"
						maskThreshold={0.5}
						dataMin={0}
						dataMax={1}
					/>
				{/if}
			{/snippet}

			{#if compareActive}
				<CompareMap bounds={[-33, 25, 40, 72]}>
					{#snippet left()}
						{#if activeTab === 'species'}
							{@render speciesLayer('current')}
						{:else if activeTab === 'thermal'}
							{@render thermalLayer('current')}
						{/if}
						<DeckOverlay entries={overlayEntries} />
					{/snippet}
					{#snippet right()}
						{#if activeTab === 'species'}
							{@render speciesLayer('selected')}
						{:else if activeTab === 'thermal'}
							{@render thermalLayer('selected')}
						{/if}
						<DeckOverlay entries={overlayEntries} />
					{/snippet}
				</CompareMap>
				<div class="compare-labels">
					<span>Current</span>
					<span>{compareFutureLabel}</span>
				</div>
			{:else}
				<Map bounds={[-33, 25, 40, 72]}>
					{#if activeTab === 'species'}
						{@render speciesLayer('selected')}
					{:else if activeTab === 'thermal'}
						{@render thermalLayer('selected')}
					{:else if activeTab === 'habitat'}
						{#if habitatUrlValue && habitatStats}
							<RasterLayer
								id="habitat-raster"
								url={habitatUrlValue}
								titilerBaseUrl={PUBLIC_TITILER_URL}
								opacity={1}
								visible={true}
								colormap="purd"
								dataMin={habitatStats.min}
								dataMax={habitatStats.max}
							/>
						{/if}
					{/if}
					<DeckOverlay entries={overlayEntries} />
				</Map>
			{/if}

			{#if showCompareToggle}
				<label class="compare-toggle">
					<input type="checkbox" checked={compareMode} onchange={(e) => toggleCompareMode(e.currentTarget.checked)} />
					Split map viewer
				</label>
			{/if}

			{#if activeTab === 'species' && predUrl}
				<div class="map-legend">
					<ColormapLegend colormap={predColormap} min={predDataMin} max={1} />
					<span class="legend-caption">
						{speciesView.showUncertainty ? 'Prediction uncertainty' : 'Relative occurrence probability'}
					</span>
				</div>
			{:else if activeTab === 'thermal' && thermUrl}
				<div class="map-legend">
					<div class="swatch-row"><span class="swatch" style="background:#08519c"></span><span>Suitable</span></div>
					<span class="legend-caption">Thermal range</span>
				</div>
			{:else if activeTab === 'habitat' && habitatUrlValue && habitatStats}
				<div class="map-legend">
					<ColormapLegend colormap="purd" min={habitatStats.min} max={habitatStats.max >= 100 ? habitatStats.max / 100 : habitatStats.max} />
					<span class="legend-caption">Sum of species' likelihood of occurrence</span>
				</div>
			{/if}
		</div>

		<div class="panel-col">
			<TabBar tabs={TABS} active={activeTab} onSelect={(id) => (activeTab = id as TabId)} />
			{#if activeTab === 'species'}
				<SpeciesTab />
			{:else if activeTab === 'thermal'}
				<ThermalTab />
			{:else if activeTab === 'habitat'}
				<HabitatTab />
			{/if}
		</div>
	</div>

	<div class="bottom-row">
		<ExtraControls variant={activeTab} />
		{#if activeTab === 'species'}
			<ResultsGrid />
			<AdditionalDetails />
		{:else if activeTab === 'thermal'}
			<ThermalResultsGrid />
		{:else if activeTab === 'habitat'}
			<HabitatResultsGrid />
		{/if}
	</div>

	<Footer />
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
		background: #f6f6f6;
		color: #1e293b;
	}

	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	.top-row {
		display: flex;
		height: 640px;
		flex-shrink: 0;
		border-bottom: 1px solid #d8d8d8;
		background: #ffffff;
	}

	.map-col {
		flex: 1;
		position: relative;
		min-width: 0;
	}

	.compare-labels {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.75rem;
		pointer-events: none;
	}
	.compare-labels span {
		background: rgba(255, 255, 255, 0.88);
		border-radius: 6px;
		padding: 0.2rem 0.6rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: #003469;
	}
	.compare-toggle {
		position: absolute;
		bottom: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 6;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		padding: 0.35rem 0.6rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: #1e293b;
		cursor: pointer;
	}

	.map-legend {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 5;
		background: rgba(255, 255, 255, 0.92);
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		border: 1px solid #d8d8d8;
		width: 190px;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.legend-caption {
		font-size: 0.65rem;
		color: #475569;
	}
	.swatch-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.68rem;
		color: #1e293b;
	}
	.swatch {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		border: 1px solid #c6c6c6;
		flex-shrink: 0;
	}

	.panel-col {
		width: 400px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid #d8d8d8;
		overflow: hidden;
	}

	.bottom-row {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1rem 1.25rem 1.5rem;
	}
</style>
