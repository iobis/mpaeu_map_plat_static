<script lang="ts">
	/**
	 * HabitatTab.svelte
	 *
	 * The "HABITAT" control tab — mirrors quarto_components/_habitat.qmd: no
	 * species selector at all, just 6 fixed habitat types (seagrass/kelp/
	 * polychaete reefs/maerl/corals/bivalves beds) with their own threshold/
	 * post-treatment/scenario/period/binary controls. Context text comes
	 * from the Shiny app's `www/context_info.json` (`habitats.*`), copied to
	 * static/data/context_info.json.
	 */
	import { base } from '$app/paths';
	import { SCENARIO_OPTIONS, PERIOD_OPTIONS, type ScenarioCode, type PeriodCode } from '$lib/data/species-catalogue.js';
	import {
		HABITAT_OPTIONS,
		HABITAT_THRESHOLD_OPTIONS,
		POST_TREATMENT_OPTIONS,
		habitatUrl,
		type HabitatId,
		type HabitatThreshold,
		type PostTreatment
	} from '$lib/data/habitat-catalogue.js';
	import { downloadRemoteFile } from '$lib/data/species-download.js';
	import { habitatView } from '$lib/stores/habitatView.svelte.js';

	let downloading = $state(false);
	let contextHtml = $state<Record<string, string[]> | null>(null);

	$effect(() => {
		if (contextHtml || !habitatView.habitat) return;
		fetch(`${base}/data/context_info.json`)
			.then((r) => r.json())
			.then((d) => (contextHtml = d.habitats))
			.catch((e) => console.error('[HabitatTab] Failed to load context_info.json:', e));
	});

	const description = $derived(habitatView.habitat ? (contextHtml?.[habitatView.habitat]?.[0] ?? '') : '');

	const currentUrl = $derived.by(() => {
		if (!habitatView.habitat) return null;
		return habitatUrl(habitatView.habitat, habitatView.scenario, habitatView.period, habitatView.threshold, habitatView.postTreatment, habitatView.binary);
	});

	async function downloadCurrent() {
		if (!currentUrl || downloading) return;
		downloading = true;
		try {
			await downloadRemoteFile(currentUrl, currentUrl.slice(currentUrl.lastIndexOf('/') + 1));
		} catch (e) {
			console.error('[HabitatTab] Failed to download habitat raster:', e);
		} finally {
			downloading = false;
		}
	}
</script>

<div class="habitat-tab">
	<label class="field">
		<span class="field-label">Select habitat</span>
		<select
			class="ctrl-select"
			value={habitatView.habitat ?? ''}
			onchange={(e) => (habitatView.habitat = (e.currentTarget.value || null) as HabitatId | null)}
		>
			<option value="">Select a habitat</option>
			{#each HABITAT_OPTIONS as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>

	<label class="field">
		<span class="field-label">Threshold</span>
		<select class="ctrl-select" value={habitatView.threshold} onchange={(e) => (habitatView.threshold = e.currentTarget.value as HabitatThreshold)}>
			{#each HABITAT_THRESHOLD_OPTIONS as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>

	<button type="button" class="switch" class:on={habitatView.binary} onclick={() => (habitatView.binary = !habitatView.binary)} title="Show maps in fully binary (presence/absence) mode. Otherwise, just removes the lower limit according to the metric on the threshold selector.">
		<span class="dot" aria-hidden="true"></span>Show binary
	</button>

	{#if habitatView.habitat}
		<h2 class="habitat-title">{HABITAT_OPTIONS.find((o) => o.value === habitatView.habitat)?.label}</h2>
		{#if description}
			<div class="context-info">{@html description}</div>
		{/if}

		<div class="selectors">
			<label class="field">
				<span class="field-label">Post-treatment</span>
				<select class="ctrl-select" value={habitatView.postTreatment} onchange={(e) => (habitatView.postTreatment = e.currentTarget.value as PostTreatment)}>
					{#each POST_TREATMENT_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>

			<label class="field">
				<span class="field-label">Scenario</span>
				<select class="ctrl-select" value={habitatView.scenario} onchange={(e) => (habitatView.scenario = e.currentTarget.value as ScenarioCode)}>
					{#each SCENARIO_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>

			{#if habitatView.scenario !== 'current'}
				<label class="field">
					<span class="field-label">Period</span>
					<select class="ctrl-select" value={habitatView.period} onchange={(e) => (habitatView.period = e.currentTarget.value as PeriodCode)}>
						{#each PERIOD_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<div class="context-icons">
			<button type="button" class="icon-btn" onclick={downloadCurrent} disabled={downloading}>
				<span class="icon" aria-hidden="true">⬇</span> {downloading ? 'Preparing…' : 'Download the data'}
			</button>
			<a class="icon-btn" href="https://github.com/iobis/mpaeu_sdm/blob/main/codes/post_habitat.R" target="_blank" rel="noopener">
				<span class="icon" aria-hidden="true"></span> Access the code
			</a>
		</div>
	{:else}
		<p class="empty-hint">Select a habitat to see its distribution model.</p>
	{/if}
</div>

<style>
	.habitat-tab {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.85rem 0.9rem;
		overflow-y: auto;
		flex: 1;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.field-label {
		font-size: 0.68rem;
		font-weight: 600;
		color: #475569;
	}
	.ctrl-select {
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.35rem 0.45rem;
		font-size: 0.78rem;
	}

	.switch {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: 1px solid #d4d4d4;
		border-radius: 999px;
		padding: 0.28rem 0.65rem;
		font-size: 0.7rem;
		color: #64748b;
		cursor: pointer;
	}
	.switch .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid #94a3b8;
	}
	.switch.on {
		border-color: #006cd7;
		color: #006cd7;
		font-weight: 600;
	}
	.switch.on .dot {
		background: #006cd7;
		border-color: #006cd7;
	}

	.habitat-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #006cd7;
		margin: 0.3rem 0 0;
	}
	.context-info {
		background: #ffffff;
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		padding: 0.6rem 0.7rem;
		font-size: 0.72rem;
		color: #475569;
		line-height: 1.5;
	}

	.selectors {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.2rem;
		border-top: 1px solid #ebebeb;
	}

	.context-icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding-top: 0.6rem;
		border-top: 1px solid #ebebeb;
	}
	.icon-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
		justify-content: center;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 6px;
		color: #475569;
		padding: 0.4rem 0.5rem;
		font-size: 0.66rem;
		font-weight: 600;
		text-decoration: none;
		text-align: center;
		cursor: pointer;
	}
	.icon-btn:hover:not(:disabled) {
		background: #e2e8f0;
	}
	.icon-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.icon-btn .icon {
		font-size: 0.72rem;
	}

	.empty-hint {
		font-size: 0.75rem;
		color: #94a3b8;
	}
</style>
