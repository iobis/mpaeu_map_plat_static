<script lang="ts">
	import { page } from '$app/state';
	import { Map, RasterLayer } from '$lib/components/maplibre/index.js';
	import { PUBLIC_TITILER_URL } from '$env/static/public';

	// Real, confirmed-overhanging (~6e-6 deg past +-180) full-world COG — the
	// same one that broke deck.gl-geotiff's tile selection near the dateline.
	const COG_URL =
		'https://obis-maps.s3.us-east-1.amazonaws.com/sdm/species/taxonid=243036/model=mpaeu/predictions/taxonid=243036_model=mpaeu_method=rf_classification_ds_scen=current_cog.tif';

	const worldCopies = page.url.searchParams.get('worldcopies') !== '0';
	const side = page.url.searchParams.get('side') ?? 'antimeridian';
	const lngParam = page.url.searchParams.get('lng');
	const zoomParam = page.url.searchParams.get('zoom');
	const zoom = zoomParam ? +zoomParam : 6;

	const center: [number, number] =
		side === 'custom' && lngParam
			? [+lngParam, 20]
			: side === 'greenwich'
				? [0, 20]
				: side === 'europe'
					? [10, 45]
					: side === 'globe'
						? [0, 0]
						: [180, 20];
</script>

<svelte:head><title>TiTiler engine check</title></svelte:head>

<div class="controls">
	<a href="?zoom=6&side=antimeridian">antimeridian z6</a>
	<a href="?zoom=6&side=custom&lng=-160">lng=-160 z6 (previously broken)</a>
	<a href="?zoom=0&side=globe">whole globe z0 (distortion check)</a>
	<a href="?zoom=1&side=globe">whole globe z1</a>
	<a href="?zoom=2&side=globe">whole globe z2</a>
	<a href="?zoom=6&side=europe">control: europe z6</a>
	<span class="status">zoom={zoom} side={side} center={center.join(',')} titiler={PUBLIC_TITILER_URL}</span>
</div>

<div class="map-wrap">
	<Map {center} {zoom} renderWorldCopies={worldCopies}>
		<RasterLayer
			id="spike-raster"
			url={COG_URL}
			titilerBaseUrl={PUBLIC_TITILER_URL}
			bandIndex={0}
			opacity={1}
			visible={true}
			colormap="blues"
			dataMin={0}
			dataMax={100}
		/>
	</Map>
</div>

<style>
	:global(body) { margin: 0; }
	.controls {
		position: absolute; top: 0; left: 0; right: 0; z-index: 20;
		background: rgba(255,255,255,0.95); padding: 6px 10px; font: 12px system-ui, sans-serif;
		display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
	}
	.status { margin-left: auto; color: #555; }
	.map-wrap { position: absolute; inset: 0; top: 34px; }
</style>
