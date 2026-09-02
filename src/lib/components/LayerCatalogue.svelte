<script lang="ts">
	import { LAYER_CATALOGUE, type LayerConfig } from '$lib/data/layers.js';
	import { activeLayers } from '$lib/stores/activeLayers.svelte.js';

	// ── Group layers by category ───────────────────────────────────────────────────
	const groups = $derived.by(() => {
		const map = new Map<string, LayerConfig[]>();
		for (const layer of LAYER_CATALOGUE) {
			if (!map.has(layer.category)) map.set(layer.category, []);
			map.get(layer.category)!.push(layer);
		}
		return map;
	});

	// ── Category expand/collapse — default to expanded for this small demo catalogue ──
	let expanded = $state<Record<string, boolean>>(
		Object.fromEntries([...new Set(LAYER_CATALOGUE.map((l) => l.category))].map((c) => [c, true]))
	);

	// ── Info accordion: one open at a time ────────────────────────────────────────
	let openInfoId = $state<string | null>(null);

	function toggleInfo(id: string) {
		openInfoId = openInfoId === id ? null : id;
	}
</script>

<aside class="catalogue">
	<div class="catalogue-header">
		<h1 class="catalogue-title">MPA Europe — Map Infrastructure Demo</h1>
		<p class="catalogue-sub">
			Phase 1: COG raster + mask, occurrence points, vector polygon, and compare mode against real data.
		</p>
	</div>

	<div class="catalogue-body">
		{#each groups as [category, layers]}
			<div class="category">
				<button
					class="category-header"
					onclick={() => (expanded[category] = !expanded[category])}
					aria-expanded={expanded[category]}
				>
					<span class="chevron" class:open={expanded[category]}>›</span>
					<span class="category-name">{category}</span>
					<span class="category-count">{layers.length}</span>
				</button>

				{#if expanded[category]}
					<ul class="layer-list">
						{#each layers as layer (layer.id)}
							{@const active = activeLayers.isActive(layer.id)}
							{@const infoOpen = openInfoId === layer.id}
							<li class="layer-item" class:active>
								<div class="layer-row">
									<button
										class="layer-toggle"
										onclick={() => activeLayers.toggle(layer)}
										title={active ? 'Remove layer' : 'Add layer'}
									>
										<span class="layer-check" aria-hidden="true">
											{#if active}<span class="check-mark">✓</span>{/if}
										</span>
										<span class="layer-name">{layer.name}</span>
									</button>

									<button
										class="info-btn"
										class:info-open={infoOpen}
										onclick={() => toggleInfo(layer.id)}
										title={infoOpen ? 'Hide info' : 'Show info'}
										aria-label="Layer info"
									>ℹ</button>
								</div>

								{#if infoOpen}
									<div class="info-panel">
										{#if layer.description}
											<p class="info-desc">{layer.description}</p>
										{/if}
										<span class="info-source">
											<strong>Source:</strong>
											{#if layer.source.startsWith('http')}
												<a href={layer.source} target="_blank" rel="noopener">{layer.source}</a>
											{:else}
												{layer.source}
											{/if}
										</span>
										{#if layer.link}
											<span class="info-source">
												<strong>Link:</strong>
												<a href={layer.link} target="_blank" rel="noopener">{layer.link}</a>
											</span>
										{/if}
										<span class="info-type">
											<strong>Type:</strong> {layer.type}
										</span>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</div>
</aside>

<style>
	.catalogue {
		width: 340px;
		flex-shrink: 0;
		background: #f6f6f6;
		border-right: 1px solid #d8d8d8;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.catalogue-header {
		padding: 1rem;
		border-bottom: 1px solid #d8d8d8;
		flex-shrink: 0;
	}
	.catalogue-title {
		font-size: 1rem;
		font-weight: 700;
		color: #006cd7;
		margin: 0 0 0.4rem;
	}
	.catalogue-sub {
		font-size: 0.72rem;
		color: #64748b;
		margin: 0;
		line-height: 1.45;
	}

	.catalogue-body {
		padding: 0.25rem 0;
	}

	.category { margin-bottom: 0.1rem; }

	.category-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		color: #006cd7;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		text-align: left;
		user-select: none;
	}
	.category-header:hover { color: #0080ff; }

	.chevron {
		font-size: 1rem;
		line-height: 1;
		transition: transform 0.15s;
		transform: rotate(0deg);
		flex-shrink: 0;
	}
	.chevron.open { transform: rotate(90deg); }

	.category-name { flex: 1; }

	.category-count {
		background: #94a3b8;
		color: #ffffff;
		font-size: 0.6rem;
		padding: 0.05rem 0.35rem;
		border-radius: 999px;
		flex-shrink: 0;
	}

	.layer-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.layer-item {
		border-left: 2px solid transparent;
		transition: border-color 0.12s;
	}
	.layer-item.active {
		border-left-color: #006cd7;
	}

	.layer-row {
		display: flex;
		align-items: flex-start;
		gap: 0;
	}

	.layer-toggle {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		padding: 0.42rem 0.5rem 0.42rem 0.6rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}
	.layer-toggle:hover { background: #e8edf3; }

	.layer-check {
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid #c2cdd9;
		border-radius: 3px;
		background: #fff;
		transition: background 0.1s, border-color 0.1s;
	}
	.layer-item.active .layer-check {
		background: #006cd7;
		border-color: #006cd7;
	}
	.check-mark {
		font-size: 0.65rem;
		color: #ffffff;
		font-weight: 700;
	}

	.layer-name {
		flex: 1;
		font-size: 0.8rem;
		color: #1e293b;
		word-break: break-word;
	}
	.layer-item.active .layer-name { font-weight: 600; }

	.info-btn {
		flex-shrink: 0;
		width: 1.7rem;
		height: 1.7rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.8rem;
		color: #94a3b8;
		border-radius: 4px;
		margin-right: 0.25rem;
		transition: background 0.1s, color 0.1s;
	}
	.info-btn:hover  { background: #e2e8f0; color: #006cd7; }
	.info-btn.info-open { background: #dbeafe; color: #006cd7; }

	.info-panel {
		padding: 0.5rem 0.75rem 0.6rem 1.85rem;
		background: #eef2f7;
		border-top: 1px solid #d8d8d8;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.info-desc {
		font-size: 0.72rem;
		color: #334155;
		margin: 0;
		line-height: 1.45;
	}
	.info-source,
	.info-type {
		font-size: 0.68rem;
		color: #64748b;
	}
	.info-source a { color: #006cd7; text-decoration: none; }
	.info-source a:hover { text-decoration: underline; }
</style>
