<script lang="ts">
	/**
	 * ExpertReviewBox.svelte
	 *
	 * Mirrors the "Expert review" / "Threatened status" badge pair
	 * `general_functions.R`'s `gen_context_boxes()` renders under the
	 * species title: whether the model has been peer-reviewed, the derived
	 * model-quality bucket (from `experteval.json`, see
	 * species-eval-loader.ts), and the IUCN Red List category (already in
	 * species-index.parquet — no extra fetch needed for that one). The link
	 * below opens ExpertEvalModal with the full review, if any.
	 */
	import { expertEvalUrl } from '$lib/data/species-catalogue.js';
	import { loadExpertEval, redlistColor, MODEL_QUALITY_COLORS, REVIEWED_COLORS, type ExpertEval } from '$lib/data/species-eval-loader.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';
	import ExpertEvalModal from './ExpertEvalModal.svelte';

	let evalResult = $state<ExpertEval | null>(null);
	let loading = $state(false);
	let key = '';
	let modalOpen = $state(false);

	$effect(() => {
		const sp = speciesView.species;
		if (!sp) return;
		if (key === String(sp.taxonID)) return;
		key = String(sp.taxonID);
		evalResult = null;
		loading = true;
		loadExpertEval(expertEvalUrl(sp.taxonID))
			.then((e) => (evalResult = e))
			.catch((e) => console.error('[ExpertReviewBox] Failed to load expert evaluation:', e))
			.finally(() => (loading = false));
	});

	const reviewed = $derived(evalResult?.evaluated ?? false);
	const modelQuality = $derived(evalResult?.modelQuality ?? 'Not assessed');
	const redlist = $derived(speciesView.species?.redlistCategory ?? 'Not available');
</script>

{#if speciesView.species}
	<div class="status-block">
		<div class="status-row">
			<div class="status-group">
				<span class="group-label">Expert review</span>
				<div class="badge-pair">
					<div class="badge" title="Model revision done by specialists.">
						<span class="badge-label">Reviewed</span>
						<span class="badge-value" style="background:{reviewed ? REVIEWED_COLORS.yes : REVIEWED_COLORS.no}">
							{loading ? '…' : reviewed ? 'Yes' : 'No'}
						</span>
					</div>
					<div class="badge" title="Takes into account both the peer review of the model and its performance metrics.">
						<span class="badge-label">Model quality</span>
						<span class="badge-value" style="background:{MODEL_QUALITY_COLORS[modelQuality]}">
							{loading ? '…' : modelQuality}
						</span>
					</div>
				</div>
			</div>

			<div class="status-group">
				<span class="group-label">IUCN Red List</span>
				<div class="badge-pair">
					<div class="badge" title="According to the IUCN Red List.">
						<span class="badge-label">Threatened status</span>
						<span class="badge-value" style="background:{redlistColor(redlist)}">{redlist}</span>
					</div>
				</div>
			</div>
		</div>

		<button type="button" class="eval-link" onclick={() => (modalOpen = true)}>
			{reviewed ? 'Model evaluation details' : 'Help to evaluate this model'}
		</button>
	</div>

	<ExpertEvalModal bind:open={modalOpen} {evalResult} />
{/if}

<style>
	.status-block {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-top: 0.15rem;
		padding-bottom: 0.15rem;
	}
	.status-row {
		display: flex;
		gap: 1.1rem;
	}
	.status-group {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.group-label {
		font-size: 0.66rem;
		font-weight: 700;
		color: #3c4046;
	}
	.badge-pair {
		display: flex;
		gap: 0.35rem;
		border: 1px solid #d8d8d8;
		border-radius: 6px;
		padding: 0.3rem;
	}
	.badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}
	.badge-label {
		font-size: 0.6rem;
		color: #64748b;
		text-align: center;
	}
	.badge-value {
		display: inline-block;
		min-width: 3.4rem;
		text-align: center;
		border-radius: 4px;
		padding: 0.1rem 0.4rem;
		font-size: 0.66rem;
		font-weight: 700;
		color: #ffffff;
	}
	.eval-link {
		align-self: flex-start;
		background: none;
		border: none;
		color: #006cd7;
		font-size: 0.68rem;
		font-weight: normal;
		cursor: pointer;
		padding: 0;
		text-decoration: none;
	}
</style>
