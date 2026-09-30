<script lang="ts">
	/**
	 * ScenarioSelect.svelte
	 *
	 * The "Scenario" dropdown, shared by the Species/Thermal/Habitat tabs
	 * (previously duplicated inline in each) — factored out so the SSP
	 * explanation (info icon + the more prominent inline callout once a
	 * non-current scenario is picked) only has to live in one place.
	 */
	import { SCENARIO_OPTIONS, SCENARIO_EXPLANATIONS, type ScenarioCode } from '$lib/data/species-catalogue.js';
	import InfoIcon from '$lib/components/InfoIcon.svelte';

	interface Props {
		value: ScenarioCode;
		onChange: (value: ScenarioCode) => void;
	}
	let { value, onChange }: Props = $props();

	const SCENARIO_ENTRIES = SCENARIO_OPTIONS.map((o) => ({ term: o.label, description: SCENARIO_EXPLANATIONS[o.value] }));
	const SCENARIO_TOOLTIP = SCENARIO_ENTRIES.map((e) => `${e.term}: ${e.description}`).join('\n\n');
</script>

<label class="field">
	<span class="field-label-row">
		<span class="field-label">Scenario</span>
		<InfoIcon label="Climate scenarios" tooltip={SCENARIO_TOOLTIP} entries={SCENARIO_ENTRIES} />
	</span>
	<select class="ctrl-select" {value} onchange={(e) => onChange(e.currentTarget.value as ScenarioCode)}>
		{#each SCENARIO_OPTIONS as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</label>

{#if value !== 'current'}
	<p class="scenario-callout">{SCENARIO_EXPLANATIONS[value]}</p>
{/if}

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.field-label-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
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
	.scenario-callout {
		margin: 0;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 6px;
		padding: 0.45rem 0.6rem;
		font-size: 0.68rem;
		line-height: 1.5;
		color: #1e3a8a;
	}
</style>
