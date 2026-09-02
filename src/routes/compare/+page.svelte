<script lang="ts">
	import { CompareMap, RasterLayer } from '$lib/components/maplibre/index.js';
	import { LAYER_CATALOGUE } from '$lib/data/layers.js';
	import { PUBLIC_TITILER_URL } from '$env/static/public';

	const current = LAYER_CATALOGUE.find((l) => l.id === 'amphiura_incana_current')!;
	const future = LAYER_CATALOGUE.find((l) => l.id === 'amphiura_incana_ssp126_2100')!;
</script>

<svelte:head><title>Compare mode demo</title></svelte:head>

<div class="labels">
	<span>Current</span>
	<span>SSP1-2.6 · 2100</span>
</div>
<div class="map-wrap">
	<CompareMap bounds={[-33, 25, 40, 72]}>
		{#snippet left()}
			<RasterLayer
				id={current.id}
				url={current.url}
				titilerBaseUrl={PUBLIC_TITILER_URL}
				opacity={1}
				visible={true}
				colormap={current.colormap ?? 'blues'}
				dataMin={current.dataMin ?? 0}
				dataMax={current.dataMax ?? 100}
			/>
		{/snippet}
		{#snippet right()}
			<RasterLayer
				id={future.id}
				url={future.url}
				titilerBaseUrl={PUBLIC_TITILER_URL}
				opacity={1}
				visible={true}
				colormap={future.colormap ?? 'blues'}
				dataMin={future.dataMin ?? 0}
				dataMax={future.dataMax ?? 100}
			/>
		{/snippet}
	</CompareMap>
</div>

<style>
	:global(body) { margin: 0; }
	.labels {
		position: absolute; top: 0.75rem; left: 50%; transform: translateX(-50%);
		z-index: 20; display: flex; gap: 8rem; font: 600 0.85rem system-ui, sans-serif;
		color: #184e77; pointer-events: none;
	}
	.map-wrap { position: absolute; inset: 0; }
</style>
