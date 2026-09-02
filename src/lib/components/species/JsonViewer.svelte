<script lang="ts">
	/**
	 * JsonViewer.svelte
	 *
	 * A small hand-rolled collapsible JSON tree — stands in for Shiny's
	 * `listviewer::jsonedit` for the "Model details" section. No dependency
	 * added for this: the recursion is simple enough (render a key, and if
	 * the value is an object/array, recurse into a toggleable child list)
	 * that a tiny self-recursive component (a self-import, see the bottom of
	 * this script block) is a better fit than pulling in a JSON-tree package
	 * for one view.
	 */
	import Self from './JsonViewer.svelte';

	interface Props {
		label: string;
		value: unknown;
		depth?: number;
	}
	let { label, value, depth = 0 }: Props = $props();

	function initiallyExpanded() {
		return depth < 2;
	}
	let expanded = $state(initiallyExpanded());

	const isObject = $derived(value !== null && typeof value === 'object' && !Array.isArray(value));
	const isArray = $derived(Array.isArray(value));
	const isExpandable = $derived(isObject || isArray);

	const entries = $derived.by((): [string, unknown][] => {
		if (isArray) return (value as unknown[]).map((v, i) => [String(i), v]);
		if (isObject) return Object.entries(value as Record<string, unknown>);
		return [];
	});

	function summary(): string {
		if (isArray) return `[${(value as unknown[]).length}]`;
		if (isObject) return `{${Object.keys(value as object).length}}`;
		return '';
	}

	function valueClass(v: unknown): string {
		if (v === null) return 'v-null';
		switch (typeof v) {
			case 'string':
				return 'v-string';
			case 'number':
				return 'v-number';
			case 'boolean':
				return 'v-boolean';
			default:
				return '';
		}
	}

	function formatPrimitive(v: unknown): string {
		if (v === null) return 'null';
		if (typeof v === 'string') return `"${v}"`;
		return String(v);
	}
</script>

<div class="node" style="--depth: {depth}">
	{#if isExpandable}
		<button type="button" class="row toggle-row" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
			<span class="chevron" class:open={expanded}>›</span>
			<span class="key">{label}</span>
			<span class="type-summary">{summary()}</span>
		</button>
		{#if expanded}
			<div class="children">
				{#each entries as [childKey, childValue] (childKey)}
					<Self label={childKey} value={childValue} depth={depth + 1} />
				{/each}
			</div>
		{/if}
	{:else}
		<div class="row leaf-row">
			<span class="key">{label}</span>
			<span class="colon">:</span>
			<span class="value {valueClass(value)}">{formatPrimitive(value)}</span>
		</div>
	{/if}
</div>

<style>
	.node {
		font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 0.7rem;
	}
	.row {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
		padding: 0.1rem 0;
	}
	.toggle-row {
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
		padding-left: 0;
	}
	.chevron {
		display: inline-block;
		width: 0.9em;
		flex-shrink: 0;
		transition: transform 0.1s;
		color: #94a3b8;
	}
	.chevron.open {
		transform: rotate(90deg);
	}
	.key {
		color: #475569;
		font-weight: 600;
	}
	.type-summary {
		color: #94a3b8;
	}
	.colon {
		color: #94a3b8;
	}
	.value {
		color: #1e293b;
		word-break: break-word;
	}
	.v-string {
		color: #15803d;
	}
	.v-number {
		color: #006cd7;
	}
	.v-boolean {
		color: #b45309;
	}
	.v-null {
		color: #94a3b8;
		font-style: italic;
	}
	.leaf-row {
		padding-left: 1.15em;
	}
	.children {
		margin-left: 1.15em;
		border-left: 1px solid #ebebeb;
		padding-left: 0.4em;
	}
</style>
