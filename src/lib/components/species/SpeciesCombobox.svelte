<script lang="ts">
	/**
	 * SpeciesCombobox.svelte
	 *
	 * A type-ahead search box over the full 12,039-species index (already
	 * loaded in memory by the time this renders — see speciesView.init()).
	 * Replaces the plain <select> from the single-demo-species version:
	 * a native <select> with 12k <option>s is exactly the kind of thing
	 * Shiny itself avoids by using a server-side selectize widget — here the
	 * equivalent is "search the in-memory array on every keystroke", which
	 * profiles at low single-digit milliseconds, so no debounce is used.
	 *
	 * Reused by both the Species and Thermal Range tabs (they search the
	 * exact same 12,039-species list, per the Shiny app) — takes the backing
	 * selection store as a `view` prop instead of importing one directly.
	 */
	import { searchSpecies, type SpeciesSelectionView } from '$lib/data/species-index-loader.js';

	interface Props {
		view: SpeciesSelectionView;
	}
	let { view }: Props = $props();

	function initialQuery() {
		return view.species?.scientificName ?? '';
	}
	let query = $state(initialQuery());
	let open = $state(false);
	let highlighted = $state(0);
	let inputEl: HTMLInputElement;

	const allMatches = $derived(searchSpecies(view.filteredIndex, query, Infinity));
	const candidates = $derived(allMatches.slice(0, 40));

	function onInput() {
		open = true;
		highlighted = 0;
	}

	function select(taxonID: number, name: string) {
		view.selectSpecies(taxonID);
		query = name;
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			open = true;
			return;
		}
		if (!open) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = Math.min(highlighted + 1, candidates.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const c = candidates[highlighted];
			if (c) select(c.taxonID, c.scientificName);
		} else if (e.key === 'Escape') {
			open = false;
			inputEl.blur();
		}
	}
</script>

<div class="combobox">
	<input
		bind:this={inputEl}
		type="text"
		class="combobox-input"
		placeholder="Search species by name…"
		role="combobox"
		aria-expanded={open}
		aria-controls="species-combobox-listbox"
		aria-autocomplete="list"
		value={query}
		oninput={(e) => {
			query = e.currentTarget.value;
			onInput();
		}}
		onfocus={() => (open = true)}
		onkeydown={onKeydown}
	/>

	{#if open && candidates.length}
		<ul class="dropdown" id="species-combobox-listbox" role="listbox">
			{#each candidates as c, i (c.taxonID)}
				<li>
					<button
						type="button"
						class="option"
						class:highlighted={i === highlighted}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => select(c.taxonID, c.scientificName)}
						role="option"
						aria-selected={i === highlighted}
					>
						<span class="sci-name">{c.scientificName}</span>
						{#if c.commonNames.length}
							<span class="common-name">{c.commonNames[0]}</span>
						{/if}
					</button>
				</li>
			{/each}
			{#if allMatches.length > candidates.length}
				<li class="more-hint">+{allMatches.length - candidates.length} more — keep typing to narrow it down</li>
			{/if}
		</ul>
	{:else if open && query.trim()}
		<div class="dropdown empty-state">No species match "{query}"{view.filterActive ? ' within the current filter' : ''}.</div>
	{/if}
</div>

<style>
	.combobox {
		position: relative;
	}
	.combobox-input {
		width: 100%;
		box-sizing: border-box;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.35rem 0.45rem;
		font-size: 0.78rem;
	}
	.combobox-input:focus {
		outline: 2px solid #006cd7;
		outline-offset: -1px;
	}

	.dropdown {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.25rem);
		left: 0;
		right: 0;
		max-height: 320px;
		overflow-y: auto;
		background: #ffffff;
		border: 1px solid #d4d4d4;
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		margin: 0;
		padding: 0.3rem;
		list-style: none;
	}

	.option {
		width: 100%;
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		background: none;
		border: none;
		text-align: left;
		padding: 0.35rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
	}
	.option.highlighted,
	.option:hover {
		background: #eef2f7;
	}
	.sci-name {
		font-size: 0.76rem;
		font-style: italic;
		color: #1e293b;
	}
	.common-name {
		font-size: 0.65rem;
		color: #94a3b8;
	}

	.more-hint {
		padding: 0.35rem 0.5rem;
		font-size: 0.65rem;
		color: #94a3b8;
	}

	.empty-state {
		padding: 0.6rem 0.7rem;
		font-size: 0.72rem;
		color: #94a3b8;
	}
</style>
