<script lang="ts">
	/**
	 * ExpertEvalModal.svelte
	 *
	 * Mirrors `general_functions.R`'s `evaluation_modal()`: the peer-review
	 * table (one row per evaluator, one column per questionnaire question)
	 * plus the scored summary, or — if nobody has reviewed the species yet —
	 * the same "help us evaluate" placeholder text the Shiny app shows.
	 */
	import type { ExpertEval } from '$lib/data/species-eval-loader.js';

	interface Props {
		open: boolean;
		evalResult: ExpertEval | null;
	}
	let { open = $bindable(false), evalResult }: Props = $props();

	const questionColumns = $derived.by(() => {
		const first = evalResult?.evaluations[0];
		if (!first) return [];
		return Object.keys(first).filter((k) => k !== 'Evaluator' && k !== 'taxonID');
	});

	function close() {
		open = false;
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

{#if open}
	<div class="backdrop" onclick={close} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal" role="dialog" aria-modal="true" aria-label="Model evaluation details" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={onKeydown}>
			<div class="modal-header">
				<h3>Model evaluation</h3>
				<button type="button" class="close-btn" onclick={close} aria-label="Close">✕</button>
			</div>
			<div class="modal-body">
				{#if !evalResult}
					<p class="hint">Loading…</p>
				{:else if !evalResult.evaluated}
					<p class="placeholder">
						We are preparing a tool to enable peer-review of models by users. Meanwhile, if you spotted something that needs immediate action,
						contact <a href="mailto:helpdesk@obis.org">helpdesk@obis.org</a>.
					</p>
				{:else}
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th>Evaluator</th>
									{#each questionColumns as col (col)}
										<th>{col}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each evalResult.evaluations as row, i (i)}
									<tr>
										<td>{row.Evaluator}</td>
										{#each questionColumns as col (col)}
											<td>{row[col]}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<p class="thanks">
						We are extremely thankful to the evaluator(s) who voluntarily provided time to improve this tool.
					</p>
					<hr />

					{#if evalResult.summary}
						<div class="summary">
							<p class="summary-title">Evaluation summary</p>
							<p>Average score: <strong>{evalResult.summary.averageScore}</strong> (from 1–5, being 1 the best)</p>
							<p>Best evaluator score: <strong>{evalResult.summary.bestScoreN}</strong> (equivalent to question 3)</p>
							<p>
								Best model CBI score: <strong>{evalResult.summary.cbiScore}</strong> (this CBI score is converted to a 1–5 scale, being 1 the
								best, as follows: ≥0.7 → 1, ≥0.6–0.7 → 2, ≥0.5–0.6 → 3, ≥0.4–0.5 → 4, ≥0.3–0.4 → 5)
							</p>
							<p>
								Average model CBI score ± SD: <strong>{evalResult.summary.averageCbi} ± {evalResult.summary.sdCbi}</strong>
							</p>
							<p>Best model: <strong>{evalResult.summary.bestCbi?.toUpperCase()}</strong></p>
						</div>
					{/if}
				{/if}
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
		width: min(900px, 94vw);
		max-height: 85vh;
		overflow-y: auto;
		background: #ffffff;
		border-radius: 10px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #ebebeb;
	}
	.modal-header h3 {
		margin: 0;
		font-size: 0.9rem;
		color: #006cd7;
	}
	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.2rem;
		line-height: 1;
	}
	.close-btn:hover {
		color: #1e293b;
	}
	.modal-body {
		padding: 1rem;
		font-size: 0.75rem;
		color: #1e293b;
	}
	.hint {
		color: #94a3b8;
	}
	.placeholder {
		line-height: 1.6;
	}
	.placeholder a {
		color: #006cd7;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid #ebebeb;
		border-radius: 6px;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.68rem;
	}
	th,
	td {
		padding: 0.4rem 0.55rem;
		text-align: left;
		border-bottom: 1px solid #ebebeb;
		min-width: 160px;
		vertical-align: top;
	}
	th {
		background: #f6f6f6;
		color: #475569;
		font-weight: 600;
		position: sticky;
		top: 0;
	}
	tbody tr:last-child td {
		border-bottom: none;
	}

	.thanks {
		font-size: 0.7rem;
		color: #64748b;
		margin: 0.9rem 0 0;
	}
	hr {
		border: none;
		border-top: 1px solid #ebebeb;
		margin: 0.6rem 0;
	}
	.summary p {
		margin: 0.3rem 0;
		font-size: 0.72rem;
	}
	.summary-title {
		font-weight: 700;
		color: #006cd7;
	}
</style>
