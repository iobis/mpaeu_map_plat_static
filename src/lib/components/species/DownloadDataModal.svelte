<script lang="ts">
	/**
	 * DownloadDataModal.svelte
	 *
	 * Client-side equivalent of `species_download_modal()` +
	 * `download_handlers_species.R` in the Shiny app. There's no backend to
	 * `curl::multi_download()` + `zip::zip()` server-side, so this lists the
	 * species' real files straight from the public S3 bucket (see
	 * species-download.ts) and zips them in the browser instead. "Full data"
	 * can be large (the Shiny app's own copy already steers people to the
	 * AWS CLI / R script for that, not the app itself) — kept as an option
	 * here too, just with a live computed size and a lighter "file list"
	 * alternative next to it, instead of a hard block.
	 */
	import { MODEL_LABELS, SCENARIO_OPTIONS, PERIOD_OPTIONS } from '$lib/data/species-catalogue.js';
	import { listSpeciesFiles, selectedDownloadFiles, totalSize, formatBytes, downloadFilesAsZip, downloadUrlManifest, type S3FileEntry } from '$lib/data/species-download.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';

	interface Props {
		open: boolean;
	}
	let { open = $bindable(false) }: Props = $props();

	type DownloadType = 'selected' | 'full';
	let downloadType = $state<DownloadType>('selected');
	let allFiles = $state<S3FileEntry[] | null>(null);
	let listLoading = $state(false);
	let listError = $state(false);
	let busy = $state(false);
	let progress = $state({ done: 0, total: 0 });

	let listedTaxonID = -1;

	$effect(() => {
		const sp = speciesView.species;
		if (!open || !sp) return;
		if (listedTaxonID === sp.taxonID) return;
		listedTaxonID = sp.taxonID;
		allFiles = null;
		listLoading = true;
		listError = false;
		listSpeciesFiles(sp.taxonID)
			.then((f) => (allFiles = f))
			.catch((e) => {
				console.error('[DownloadDataModal] Failed to list species files:', e);
				listError = true;
			})
			.finally(() => (listLoading = false));
	});

	const selectedFiles = $derived.by(() => {
		const sp = speciesView.species;
		const method = speciesView.method;
		if (!sp || !method || !allFiles) return [];
		return selectedDownloadFiles(allFiles, method, speciesView.scenario, speciesView.period);
	});

	const filesToDownload = $derived(downloadType === 'full' ? (allFiles ?? []) : selectedFiles);
	const sizeLabel = $derived(allFiles ? formatBytes(totalSize(filesToDownload)) : '…');
	const isLarge = $derived(downloadType === 'full' && !!allFiles && totalSize(filesToDownload) > 250 * 1024 * 1024);

	const scenarioLabel = $derived(SCENARIO_OPTIONS.find((s) => s.value === speciesView.scenario)?.label ?? speciesView.scenario);
	const periodLabel = $derived(PERIOD_OPTIONS.find((p) => p.value === speciesView.period)?.label ?? '');

	function close() {
		if (busy) return;
		open = false;
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	async function startZipDownload() {
		const sp = speciesView.species;
		if (!sp || !filesToDownload.length || busy) return;
		busy = true;
		progress = { done: 0, total: filesToDownload.length };
		try {
			const name =
				downloadType === 'selected'
					? `taxonid=${sp.taxonID}_model=mpaeu_method=${speciesView.method}_scenario=${speciesView.scenario}${
							speciesView.scenario !== 'current' ? `_decade=${speciesView.period}` : ''
						}.zip`
					: `taxonid=${sp.taxonID}.zip`;
			await downloadFilesAsZip(filesToDownload, name, (done, total) => (progress = { done, total }));
		} catch (e) {
			console.error('[DownloadDataModal] Zip download failed:', e);
		} finally {
			busy = false;
		}
	}

	function startManifestDownload() {
		const sp = speciesView.species;
		if (!sp || !filesToDownload.length) return;
		downloadUrlManifest(filesToDownload, `taxonid=${sp.taxonID}_${downloadType}_files.txt`);
	}
</script>

{#if open && speciesView.species}
	{@const sp = speciesView.species}
	<div class="backdrop" onclick={close} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal" role="dialog" aria-modal="true" aria-label="Download species data" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={onKeydown}>
			<div class="modal-body">
				<div class="card main-card">
					<h3>Download species data</h3>
					<p class="intro">What do you want to download?</p>
					<div class="radio-row">
						<label><input type="radio" name="dl-type" value="selected" bind:group={downloadType} /> Selected species/scenario</label>
						<label><input type="radio" name="dl-type" value="full" bind:group={downloadType} /> Full data for this species</label>
					</div>
					<p class="info">
						The current species selected is <i><b>{sp.scientificName}</b></i> (AphiaID <b>{sp.taxonID}</b>) for model
						<b>{speciesView.method ? MODEL_LABELS[speciesView.method] : '—'}</b>, in the scenario <b>{scenarioLabel}</b>{speciesView.scenario !== 'current'
							? ` and decade ${periodLabel}`
							: ''}.
						<br />
						{#if listLoading}
							Calculating download size…
						{:else if listError}
							Could not list this species' files right now — try again in a moment.
						{:else}
							This download is approximately <b>{sizeLabel}</b> ({filesToDownload.length} file{filesToDownload.length === 1 ? '' : 's'}).
						{/if}
					</p>
					{#if isLarge}
						<p class="warning">
							That's a large download to zip in your browser. For reliability with this much data we recommend the AWS CLI or the R script
							(right), or use the file-list download below instead.
						</p>
					{/if}
					{#if busy}
						<p class="progress">Fetching files… {progress.done} / {progress.total}</p>
					{/if}
				</div>

				<div class="card">
					<h4>Choose the full data if…</h4>
					<ul>
						<li>You want to do further analysis with the results</li>
						<li>You want to produce other visualizations</li>
						<li>You want to run the model locally or using a JupyterHub instance (e.g. Google Colab®)</li>
					</ul>
				</div>

				<div class="card">
					<h4>Want to download all available data?</h4>
					<p>
						You can also download through our
						<a href="https://obis-maps.s3.us-east-1.amazonaws.com/index.html" target="_blank" rel="noopener">AWS S3 bucket directly</a>
						or using
						<a href="https://github.com/iobis/mpaeu_map_platform/blob/main/scripts/download_aws_model.R" target="_blank" rel="noopener">this R script</a>.
					</p>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-ghost" onclick={startManifestDownload} disabled={!filesToDownload.length || listLoading}>
					Download file list (.txt)
				</button>
				<div class="footer-actions">
					<button type="button" class="btn-ghost" onclick={close} disabled={busy}>Cancel</button>
					<button type="button" class="btn-primary" onclick={startZipDownload} disabled={busy || listLoading || !filesToDownload.length}>
						{busy ? 'Preparing…' : 'Download (.zip)'}
					</button>
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
	.card p,
	.card ul {
		font-size: 0.72rem;
		color: #475569;
		line-height: 1.55;
	}
	.card ul {
		margin: 0;
		padding-left: 1.1rem;
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
	.warning {
		color: #b45309;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 6px;
		padding: 0.4rem 0.55rem;
	}
	.progress {
		color: #006cd7;
		font-weight: 600;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid #ebebeb;
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
