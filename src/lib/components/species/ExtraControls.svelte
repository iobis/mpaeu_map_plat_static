<script lang="ts">
	/**
	 * ExtraControls.svelte
	 *
	 * The shared control strip shown just above the map/results — mirrors
	 * `_modelinfo.qmd`'s "ecsp-controls" toolbar, which is tab-aware in the
	 * Shiny app too (3 separate `conditionalPanel`s keyed on the active
	 * tab): Species gets mask type/threshold filter/uncertainty on top of
	 * the shared Realms/EEZs/MPAs switches; Thermal gets just a mask
	 * on/off switch (no mask-*type* selector — hidden in the original for
	 * that tab, reuses whatever type Species last picked) plus the shared
	 * switches; Habitat gets only the shared switches (habitat rasters have
	 * no mask). Realms/EEZs/MPAs are shared across all three tabs (mirrors
	 * the Shiny app: `ecspRealms`/`ecspEEZ`/`ecspMPA` are each a single
	 * checkbox reused across every tab's `conditionalPanel`, not per-tab
	 * state) — see mapOverlaysView.svelte.ts.
	 */
	import { THRESHOLD_OPTIONS, MASK_TYPE_LABELS, type ThresholdMode } from '$lib/data/species-catalogue.js';
	import { speciesView } from '$lib/stores/speciesView.svelte.js';
	import { thermalView } from '$lib/stores/thermalView.svelte.js';
	import { mapOverlaysView } from '$lib/stores/mapOverlaysView.svelte.js';
	import { REALMS_ATTRIBUTION, EEZ_ATTRIBUTION, MPA_ATTRIBUTION } from '$lib/data/boundary-layers.js';

	interface Props {
		variant: 'species' | 'thermal' | 'habitat';
	}
	let { variant }: Props = $props();
</script>

<div class="extra-controls">
	{#if variant === 'species'}
		<label class="ctrl">
			<span class="ctrl-label">Mask type</span>
			<select
				class="ctrl-select"
				value={speciesView.maskBandIndex}
				onchange={(e) => (speciesView.maskBandIndex = +e.currentTarget.value)}
			>
				{#each MASK_TYPE_LABELS as label, i (label)}
					<option value={i}>{label}</option>
				{/each}
			</select>
		</label>

		<label class="ctrl" title={THRESHOLD_OPTIONS.find((o) => o.value === speciesView.thresholdMode)?.hint}>
			<span class="ctrl-label">Filter</span>
			<select
				class="ctrl-select"
				value={speciesView.thresholdMode}
				onchange={(e) => (speciesView.thresholdMode = e.currentTarget.value as ThresholdMode)}
			>
				{#each THRESHOLD_OPTIONS as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<button class="switch" class:on={speciesView.maskVisible} onclick={() => (speciesView.maskVisible = !speciesView.maskVisible)}>
			<span class="dot" aria-hidden="true"></span>Show mask
		</button>

		<button class="switch" class:on={speciesView.showUncertainty} onclick={() => (speciesView.showUncertainty = !speciesView.showUncertainty)}>
			<span class="dot" aria-hidden="true"></span>Show uncertainty
		</button>

		<button
			class="switch"
			class:on={speciesView.showOccurrencePoints}
			onclick={() => (speciesView.showOccurrencePoints = !speciesView.showOccurrencePoints)}
		>
			<span class="dot" aria-hidden="true"></span>Show records
		</button>
	{:else if variant === 'thermal'}
		<button class="switch" class:on={thermalView.maskVisible} onclick={() => (thermalView.maskVisible = !thermalView.maskVisible)}>
			<span class="dot" aria-hidden="true"></span>Show mask
		</button>
	{/if}

	<button class="switch" class:on={mapOverlaysView.showRealms} onclick={() => (mapOverlaysView.showRealms = !mapOverlaysView.showRealms)}>
		<span class="dot" aria-hidden="true"></span>Show realms
	</button>
	<span class="info-icon" title={REALMS_ATTRIBUTION} aria-label={REALMS_ATTRIBUTION}>ⓘ</span>

	<button class="switch" class:on={mapOverlaysView.showEEZ} onclick={() => (mapOverlaysView.showEEZ = !mapOverlaysView.showEEZ)}>
		<span class="dot" aria-hidden="true"></span>Show EEZs
	</button>
	<span class="info-icon" title={EEZ_ATTRIBUTION} aria-label={EEZ_ATTRIBUTION}>ⓘ</span>

	<button class="switch" class:on={mapOverlaysView.showMPA} onclick={() => (mapOverlaysView.showMPA = !mapOverlaysView.showMPA)}>
		<span class="dot" aria-hidden="true"></span>Show MPAs
	</button>
	<span class="info-icon" title={MPA_ATTRIBUTION} aria-label={MPA_ATTRIBUTION}>ⓘ</span>
</div>

<style>
	.extra-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 1rem;
		background: #ffffff;
		border: 1px solid #d8d8d8;
		border-radius: 10px;
	}

	.ctrl {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.ctrl-label {
		font-size: 0.68rem;
		font-weight: 600;
		color: #475569;
		white-space: nowrap;
	}
	.ctrl-select {
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.28rem 0.4rem;
		font-size: 0.72rem;
	}

	.switch {
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
	.switch:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.info-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: -0.4rem;
		color: #94a3b8;
		font-size: 0.85rem;
		cursor: help;
	}
	.info-icon:hover {
		color: #006cd7;
	}
</style>
