<script lang="ts">
	interface Tab {
		id: string;
		label: string;
		enabled: boolean;
		/** Renders as a plain external link (new tab) instead of a tab-switching button — e.g. "Atlas for MSP", which just points at atlas.mpa-europe.eu. */
		href?: string;
	}

	interface Props {
		tabs: Tab[];
		active: string;
		onSelect: (id: string) => void;
	}

	let { tabs, active, onSelect }: Props = $props();
</script>

<div class="tab-bar" role="tablist">
	{#each tabs as tab (tab.id)}
		{#if tab.href}
			<a class="tab" href={tab.href} target="_blank" rel="noopener">
				<span class="label">{tab.label} <span class="ext-icon" aria-hidden="true">↗</span></span>
			</a>
		{:else}
			<button
				class="tab"
				class:active={tab.id === active}
				disabled={!tab.enabled}
				role="tab"
				aria-selected={tab.id === active}
				onclick={() => tab.enabled && onSelect(tab.id)}
			>
				<span class="label">{tab.label}</span>
				{#if !tab.enabled}<span class="soon">soon</span>{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	/*
	 * Per-tab background colours mirror the Shiny app's own tabset exactly
	 * (`www/styles.css`: a#tabset-1-{1..4}-tab), in the same left-to-right
	 * order (Species/Thermal/Habitat/Atlas): #184e77, #1e6091, #1a759f,
	 * #1faf9a. The active tab there swaps to the page's own background with
	 * dark navy text rather than keeping its own colour — reused here as
	 * white (this panel's own background) + #184e77, which also happens to
	 * be the exact dark navy the Footer's project band already uses, so it
	 * ties back into the rest of this rewrite's palette rather than
	 * clashing with it.
	 */
	.tab-bar {
		display: flex;
		flex-shrink: 0;
	}
	.tab {
		flex: 1;
		min-width: 0;
		border: none;
		padding: 0.6rem 0.3rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: #ffffff;
		text-decoration: none;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		transition:
			color 0.12s,
			background-color 0.12s,
			filter 0.12s;
	}
	.tab:nth-child(1) {
		background: #003469;
	}
	.tab:nth-child(2) {
		background: #004F9F;
	}
	.tab:nth-child(3) {
		background: #006CD7;
	}
	.tab:nth-child(4) {
		background: #1CBA92;
	}
	.ext-icon {
		font-size: 0.62rem;
	}
	.label {
		font-size: 0.66rem;
		line-height: 1.2;
	}
	.tab:hover:not(:disabled):not(.active) {
		filter: brightness(1.12);
	}
	.tab.active {
		background: #ffffff;
		color: #184e77;
	}
	.tab:disabled {
		cursor: default;
		filter: grayscale(0.6) brightness(1.3);
	}
	.soon {
		font-size: 0.5rem;
		font-weight: 700;
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.25);
		color: #ffffff;
		padding: 0.05rem 0.25rem;
		border-radius: 999px;
		white-space: nowrap;
	}
</style>
