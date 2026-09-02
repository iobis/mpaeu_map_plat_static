<script lang="ts">
	/**
	 * SpeciesFilterModal.svelte
	 *
	 * Mirrors filterSpeciesModal() + filter_opts() in the Shiny app
	 * (scripts/filter_functions.R, wired up in components/updateoptions.R):
	 * Group / Common name / Presence in sea-region / Include-other-projects
	 * on the left, Phylum / Class / Order / Family on the right, a live
	 * match count, Cancel/OK. Each dropdown's own choices are recomputed
	 * from every OTHER active filter (not itself) — same "faceted" behaviour
	 * as the R `filter_opts()` calls that re-populate every selectize on
	 * every change.
	 *
	 * Edits happen on a local draft; nothing reaches the shared store until
	 * OK is pressed (Cancel just discards the draft).
	 *
	 * Reused by the Species and Thermal Range tabs — takes the backing
	 * selection store as a `view` prop (see SpeciesCombobox.svelte).
	 */
	import { applyFilter, facetOptions, facetListOptions, DEFAULT_FILTER, type FilterCriteria, type SpeciesSelectionView } from '$lib/data/species-index-loader.js';

	interface Props {
		open: boolean;
		view: SpeciesSelectionView;
	}
	let { open = $bindable(false), view }: Props = $props();

	let draft = $state<FilterCriteria>({ ...DEFAULT_FILTER });

	$effect(() => {
		if (open) draft = { ...view.filter };
	});

	const matchCount = $derived(applyFilter(view.index, draft).length);

	const groupOptions = $derived(facetOptions(view.index, draft, 'group'));
	const phylumOptions = $derived(facetOptions(view.index, draft, 'phylum'));
	const classOptions = $derived(facetOptions(view.index, draft, 'class'));
	const orderOptions = $derived(facetOptions(view.index, draft, 'order'));
	const familyOptions = $derived(facetOptions(view.index, draft, 'family'));
	const commonNameOptions = $derived(facetListOptions(view.index, draft, 'commonName'));
	const regionOptions = $derived(facetListOptions(view.index, draft, 'region'));

	function cancel() {
		open = false;
	}
	function apply() {
		view.setFilter(draft);
		open = false;
	}
	function resetDraft() {
		draft = { ...DEFAULT_FILTER };
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') cancel();
	}
</script>

{#if open}
	<div class="backdrop" onclick={cancel} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="Filter species"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={onKeydown}
		>
			<div class="modal-body">
				<div class="col">
					<label class="field">
						<span class="field-label">Group</span>
						<select class="ctrl-select" bind:value={draft.group}>
							<option value="all">All</option>
							{#each groupOptions as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Common name (EN)</span>
						<select class="ctrl-select" bind:value={draft.commonName}>
							<option value="all">All</option>
							{#each commonNameOptions as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Presence in sea/region</span>
						<select class="ctrl-select" bind:value={draft.region}>
							<option value="all">All</option>
							{#each regionOptions as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="checkbox-field">
						<input type="checkbox" bind:checked={draft.includeOtherProjects} />
						<span>Include from other projects?</span>
					</label>
				</div>

				<div class="col">
					<label class="field">
						<span class="field-label">Phylum</span>
						<select class="ctrl-select" bind:value={draft.phylum}>
							<option value="all">All</option>
							{#each phylumOptions as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Class</span>
						<select class="ctrl-select" bind:value={draft.class}>
							<option value="all">All</option>
							{#each classOptions as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Order</span>
						<select class="ctrl-select" bind:value={draft.order}>
							<option value="all">All</option>
							{#each orderOptions as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Family</span>
						<select class="ctrl-select" bind:value={draft.family}>
							<option value="all">All</option>
							{#each familyOptions as v (v)}<option value={v}>{v}</option>{/each}
						</select>
					</label>
				</div>
			</div>

			<div class="modal-footer">
				<span class="match-count">Total: <strong>{matchCount}</strong> species</span>
				<div class="footer-actions">
					<button type="button" class="btn-ghost" onclick={resetDraft}>Reset</button>
					<button type="button" class="btn-ghost" onclick={cancel}>Cancel</button>
					<button type="button" class="btn-primary" onclick={apply}>OK</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(15, 23, 42, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.modal {
		width: min(720px, 92vw);
		max-height: 85vh;
		overflow-y: auto;
		background: #ffffff;
		border-radius: 10px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
	}
	.modal-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		padding: 1rem;
	}
	@media (max-width: 560px) {
		.modal-body {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		min-width: 0;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.field-label {
		font-size: 0.68rem;
		font-weight: 600;
		color: #475569;
	}
	.ctrl-select {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.35rem 0.45rem;
		font-size: 0.76rem;
	}
	.checkbox-field {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: #475569;
		margin-top: 0.2rem;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid #ebebeb;
	}
	.match-count {
		font-size: 0.72rem;
		color: #475569;
	}
	.footer-actions {
		display: flex;
		gap: 0.5rem;
	}
	.btn-ghost,
	.btn-primary {
		border-radius: 6px;
		padding: 0.35rem 0.8rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-ghost {
		background: none;
		border: 1px solid #d4d4d4;
		color: #475569;
	}
	.btn-ghost:hover {
		background: #f0f4f8;
	}
	.btn-primary {
		background: #006cd7;
		border: 1px solid #006cd7;
		color: #ffffff;
	}
	.btn-primary:hover {
		background: #0080ff;
	}
</style>
