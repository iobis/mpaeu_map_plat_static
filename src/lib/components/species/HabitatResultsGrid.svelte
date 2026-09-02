<script lang="ts">
	/**
	 * HabitatResultsGrid.svelte
	 *
	 * The Habitat tab's 2x1 contextual grid — mirrors the habitat branch of
	 * `components/contextualinfo.R`/`_modelinfo.qmd`: the species whose
	 * occurrence records went into fitting this habitat's model
	 * ("tableB" — see habitat-species-loader.ts), and the fixed "What is a
	 * biogenic habitat?" explanatory text.
	 */
	import { habitatFitoccUrl } from '$lib/data/habitat-catalogue.js';
	import { loadHabitatSpecies, type HabitatSpeciesRow } from '$lib/data/habitat-species-loader.js';
	import { habitatView } from '$lib/stores/habitatView.svelte.js';

	let species = $state<HabitatSpeciesRow[]>([]);
	let loading = $state(false);
	let loadError = $state(false);
	let key = '';

	$effect(() => {
		const habitat = habitatView.habitat;
		if (!habitat) return;
		if (key === habitat) return;
		key = habitat;
		loading = true;
		loadError = false;
		species = [];
		loadHabitatSpecies(habitatFitoccUrl(habitat))
			.then((rows) => (species = rows))
			.catch((e) => {
				console.error('[HabitatResultsGrid] Failed to load habitat species:', e);
				loadError = true;
			})
			.finally(() => (loading = false));
	});
</script>

{#if !habitatView.habitat}
	<div class="empty-grid">
		<p>Select a habitat to start.</p>
	</div>
{:else}
	<div class="results-grid">
		<section class="cell">
			<h3>Species information</h3>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else if loadError}
				<p class="hint error">Failed to load species information.</p>
			{:else}
				<div class="cell-body">
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th>AphiaID</th>
									<th>Scientific name</th>
									<th>Group</th>
									<th>Phylum</th>
									<th>Class</th>
									<th>Order</th>
									<th>Family</th>
									<th>Red List</th>
									<th>Regions of occurrence</th>
								</tr>
							</thead>
							<tbody>
								{#each species as row (row.taxonID)}
									<tr>
										<td
											><a href="https://obis.org/taxon/{row.taxonID}" target="_blank" rel="noopener">{row.taxonID}</a
											></td
										>
										<td class="sci-name">{row.scientificName}</td>
										<td>{row.group ?? '—'}</td>
										<td>{row.phylum ?? '—'}</td>
										<td>{row.class ?? '—'}</td>
										<td>{row.order ?? '—'}</td>
										<td>{row.family ?? '—'}</td>
										<td>{row.redlistCategory ?? '—'}</td>
										<td class="regions">{row.regionNames.length ? row.regionNames.join(', ') : '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</section>

		<section class="cell">
			<h3>What is a biogenic habitat?</h3>
			<div class="cell-body">
				<p class="body-text">
					A biogenic marine habitat is an environment created by living organisms, such as corals, seagrasses, mangroves, or oysters, that form
					complex structures in marine ecosystems. These habitats provide shelter, feeding grounds, and breeding areas for various marine species,
					enhancing biodiversity. They are crucial for ecosystem functions, such as nutrient cycling and shoreline protection. Examples include
					coral reefs, kelp forests, and oyster beds. Biogenic habitats are sensitive to environmental changes and human activities, making their
					conservation vital for maintaining marine biodiversity.
				</p>
			</div>
		</section>
	</div>
{/if}

<style>
	.empty-grid {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		background: #ffffff;
		border: 1px dashed #d4d4d4;
		border-radius: 10px;
	}
	.empty-grid p {
		font-size: 0.8rem;
		color: #94a3b8;
		margin: 0;
	}

	.results-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-auto-rows: 320px;
		gap: 0.75rem;
	}
	@media (max-width: 900px) {
		.results-grid {
			grid-template-columns: 1fr;
		}
	}

	.cell {
		background: #ffffff;
		border: 1px solid #d8d8d8;
		border-radius: 10px;
		padding: 0.75rem 0.9rem;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.cell h3 {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: #006cd7;
		flex-shrink: 0;
	}

	.hint {
		font-size: 0.72rem;
		color: #94a3b8;
		margin: 0;
	}
	.hint.error {
		color: #dc2626;
	}

	.cell-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.68rem;
	}
	th {
		position: sticky;
		top: 0;
		background: #f0f4f8;
		text-align: left;
		padding: 0.3rem 0.4rem;
		color: #475569;
		font-weight: 600;
		white-space: nowrap;
	}
	td {
		padding: 0.28rem 0.4rem;
		border-top: 1px solid #ebebeb;
		color: #1e293b;
		vertical-align: top;
	}
	td a {
		color: #006cd7;
		text-decoration: none;
	}
	td a:hover {
		text-decoration: underline;
	}
	.sci-name {
		font-style: italic;
		white-space: nowrap;
	}
	.regions {
		min-width: 220px;
	}

	.body-text {
		font-size: 0.75rem;
		color: #334155;
		line-height: 1.55;
		margin: 0;
	}
</style>
