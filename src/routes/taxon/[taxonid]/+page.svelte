<script lang="ts">
	/**
	 * A direct, shareable link to one species — e.g. /taxon/137080/. Renders
	 * the exact same app as the root route (AppShell.svelte), just
	 * pre-selecting that species (by AphiaID) once the species index has
	 * loaded. An unrecognised/invalid id behaves exactly like typing a bad
	 * search query normally would — AppShell/speciesView already tolerate a
	 * taxonID with no matching row (empty "select a species" state), so
	 * there's nothing extra to handle here for that case.
	 */
	import { page } from '$app/state';
	import AppShell from '$lib/components/AppShell.svelte';

	const taxonID = $derived.by(() => {
		const n = Number(page.params.taxonid);
		return Number.isFinite(n) ? n : null;
	});
</script>

<AppShell initialTaxonID={taxonID} showWelcome={false} />
