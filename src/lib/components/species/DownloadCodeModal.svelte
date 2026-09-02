<script lang="ts">
	/**
	 * DownloadCodeModal.svelte
	 *
	 * Client-side equivalent of `species_code_download()` +
	 * `get_local_file()` in the Shiny app ("RUN THE MODEL" in
	 * `_species.qmd`): fills in the same `fit_locally_model.ipynb`/`.qmd`
	 * template (copied verbatim to static/templates/) with the selected
	 * species/AphiaID/method, entirely client-side — no R backend needed
	 * since it's a plain text substitution, see species-download.ts.
	 */
	import { MODEL_LABELS } from '$lib/data/species-catalogue.js';
	import { buildLocalFitFile, downloadTextFile } from '$lib/data/species-download.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';

	interface Props {
		open: boolean;
	}
	let { open = $bindable(false) }: Props = $props();

	type CodeType = 'ipynb' | 'qmd';
	let codeType = $state<CodeType>('ipynb');
	let busy = $state(false);

	function close() {
		open = false;
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	async function download() {
		const sp = speciesView.species;
		const method = speciesView.method;
		if (!sp || !method || busy) return;
		busy = true;
		try {
			const { filename, content } = await buildLocalFitFile(sp.scientificName, sp.taxonID, method, codeType);
			downloadTextFile(filename, content);
			open = false;
		} catch (e) {
			console.error('[DownloadCodeModal] Failed to build local-fit file:', e);
		} finally {
			busy = false;
		}
	}
</script>

{#if open && speciesView.species}
	{@const sp = speciesView.species}
	<div class="backdrop" onclick={close} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal" role="dialog" aria-modal="true" aria-label="Download code to run model locally" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={onKeydown}>
			<div class="modal-body">
				<div class="card">
					<h3>Download code to run model locally</h3>
					<p class="intro">What type of code do you want?</p>
					<div class="radio-row">
						<label><input type="radio" name="code-type" value="ipynb" bind:group={codeType} /> Jupyter Notebook</label>
						<label><input type="radio" name="code-type" value="qmd" bind:group={codeType} /> Quarto document</label>
					</div>
					<p class="info">
						The current species selected is <i><b>{sp.scientificName}</b></i> (AphiaID <b>{sp.taxonID}</b>) for model
						<b>{speciesView.method ? MODEL_LABELS[speciesView.method] : '—'}</b>.
					</p>
				</div>

				<div class="card">
					<h4>What type of code do I need?</h4>
					<p>
						Choose "Quarto document" if you use RStudio as your IDE. If you use VSCode or want to run the code in a Jupyter instance (e.g.
						Google Colab®), choose "Jupyter Notebook".
					</p>
				</div>

				<div class="card">
					<h4>Remember: you also need the data</h4>
					<p>
						After downloading the code, remember to also download the data with "Download the data" in the app. You can also get all data
						through our
						<a href="https://obis-maps.s3.us-east-1.amazonaws.com/index.html" target="_blank" rel="noopener">AWS S3 bucket</a>
						or using
						<a href="https://github.com/iobis/mpaeu_map_platform/blob/main/scripts/download_aws_model.R" target="_blank" rel="noopener">this R script</a>.
					</p>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-ghost" onclick={close} disabled={busy}>Cancel</button>
				<button type="button" class="btn-primary" onclick={download} disabled={busy}>{busy ? 'Preparing…' : 'Download'}</button>
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
		width: min(920px, 94vw);
		max-height: 88vh;
		overflow-y: auto;
		background: #ffffff;
		border-radius: 10px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
	}
	.modal-body {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.9rem;
		padding: 1rem;
	}
	@media (max-width: 760px) {
		.modal-body {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.card {
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		padding: 0.8rem 0.9rem;
		min-width: 0;
	}
	.card h3 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: #006cd7;
	}
	.card h4 {
		margin: 0 0 0.4rem;
		font-size: 0.76rem;
		color: #1e293b;
	}
	.card p {
		font-size: 0.72rem;
		color: #475569;
		line-height: 1.55;
	}
	.card a {
		color: #006cd7;
	}
	.intro {
		margin: 0 0 0.4rem;
		font-weight: 600;
		color: #1e293b;
	}
	.radio-row {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 0.6rem;
		font-size: 0.75rem;
		color: #1e293b;
	}
	.radio-row label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.info {
		color: #097da5;
	}

	.modal-footer {
		display: flex;
		align-items: center;
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
	.btn-ghost:hover:not(:disabled) {
		background: #f0f4f8;
	}
	.btn-primary {
		background: #006cd7;
		border: 1px solid #006cd7;
		color: #ffffff;
	}
	.btn-primary:hover:not(:disabled) {
		background: #0080ff;
	}
	.btn-ghost:disabled,
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
