<script lang="ts">
	/**
	 * InfoIcon.svelte
	 *
	 * The small "ⓘ" help icon used throughout the control strips (Mask type,
	 * Filter, Scenario, and the Realms/EEZ/MPA source attributions) — a plain
	 * `title` attribute gives a native hover tooltip (kept exactly as before,
	 * works well and costs nothing extra), and clicking it opens the same
	 * information as a real modal — useful for touch devices (no hover at
	 * all) and for longer content that's cramped in a native tooltip box.
	 * Same backdrop/modal/Escape pattern as the project's other modals (e.g.
	 * ExpertEvalModal.svelte).
	 */
	export interface InfoEntry {
		term: string;
		description: string;
	}

	interface Props {
		/** Modal heading. */
		label: string;
		/** Plain-text hover tooltip (native `title`). */
		tooltip: string;
		/** Structured list, rendered as a definition list in the modal. Mutually exclusive with `text`. */
		entries?: InfoEntry[];
		/** A single plain-paragraph modal body (e.g. a citation). Mutually exclusive with `entries`. */
		text?: string;
	}
	let { label, tooltip, entries, text }: Props = $props();

	let open = $state(false);
	let modalEl = $state<HTMLDivElement>();
	$effect(() => {
		if (open) modalEl?.focus();
	});

	function close() {
		open = false;
	}
	function onKeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Escape') close();
	}
</script>

<button type="button" class="info-icon" title={tooltip} aria-label={tooltip} onclick={() => (open = true)}>ⓘ</button>

{#if open}
	<div class="backdrop" onclick={close} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label={label}
			tabindex="-1"
			bind:this={modalEl}
			onclick={(e) => e.stopPropagation()}
			onkeydown={onKeydown}
		>
			<div class="modal-header">
				<h3>{label}</h3>
				<button type="button" class="close-btn" onclick={close} aria-label="Close">✕</button>
			</div>
			<div class="modal-body">
				{#if entries}
					<dl>
						{#each entries as entry (entry.term)}
							<div class="entry">
								<dt>{entry.term}</dt>
								<dd>{entry.description}</dd>
							</div>
						{/each}
					</dl>
				{:else if text}
					<p>{text}</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.info-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		color: #94a3b8;
		font-size: 0.85rem;
		line-height: 1;
		cursor: pointer;
		font-family: inherit;
	}
	.info-icon:hover {
		color: #006cd7;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 210;
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.modal {
		width: min(480px, 94vw);
		max-height: 85vh;
		overflow-y: auto;
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
		outline: none;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.05rem;
		border-bottom: 1px solid #ebebeb;
	}
	.modal-header h3 {
		margin: 0;
		font-size: 0.95rem;
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
		padding: 1.05rem;
	}
	.modal-body p {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.6;
		color: #334155;
	}
	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.entry {
		padding-bottom: 0.7rem;
		border-bottom: 1px solid #f0f0f0;
	}
	.entry:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}
	dt {
		font-size: 0.78rem;
		font-weight: 700;
		color: #1e293b;
		margin-bottom: 0.2rem;
	}
	dd {
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.55;
		color: #475569;
	}
</style>
