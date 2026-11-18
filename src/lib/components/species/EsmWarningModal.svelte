<script lang="ts">
	/**
	 * EsmWarningModal.svelte
	 *
	 * Shown when the user switches on "Include ESM species". Ensembles of
	 * small models (ESM) are the fallback for species too data-poor for the
	 * full 4-algorithm ensemble, and are still experimental. "Enable" keeps
	 * the switch on; "Cancel" (or Escape / backdrop click) reverts it.
	 */
	interface Props {
		open: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}
	let { open, onConfirm, onCancel }: Props = $props();

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onCancel();
	}
</script>

{#if open}
	<div class="backdrop" onclick={onCancel} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="modal"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="esm-warning-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={onKeydown}
		>
			<div class="modal-body">
				<h3 id="esm-warning-title">⚠ Experimental models</h3>
				<p>
					Ensembles of small models (ESM) are still <strong>experimental</strong>. They are used for species with too few records for the standard
					modelling approach, so their predictions are more uncertain.
				</p>
				<p>Please interpret these models with special care.</p>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn-ghost" onclick={onCancel}>Cancel</button>
				<!-- svelte-ignore a11y_autofocus -->
				<button type="button" class="btn-primary" onclick={onConfirm} autofocus>I understand, include ESM species</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 110;
		background: rgba(15, 23, 42, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.modal {
		width: min(440px, 92vw);
		background: #ffffff;
		border-radius: 10px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
	}
	.modal-body {
		padding: 1rem 1.1rem 0.5rem;
		font-size: 0.8rem;
		color: #334155;
		line-height: 1.45;
	}
	h3 {
		margin: 0 0 0.6rem;
		font-size: 0.95rem;
		color: #b45309;
	}
	p {
		margin: 0 0 0.6rem;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid #ebebeb;
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
