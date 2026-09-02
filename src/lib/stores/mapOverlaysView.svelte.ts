/**
 * mapOverlaysView.svelte.ts
 *
 * Realms/EEZ/MPA visibility — shared across the Species, Thermal Range, and
 * Habitat tabs, mirroring the Shiny app: `input$ecspRealms`/`ecspEEZ`/`ecspMPA`
 * are each a single checkbox reused (via `conditionalPanel`) across all of
 * `_modelinfo.qmd`'s tab-specific control blocks — one shared boolean per
 * layer, not a separate one per tab — so switching tabs doesn't reset it.
 */

class MapOverlaysViewStore {
	showRealms = $state(false);
	showEEZ = $state(false);
	showMPA = $state(false);
}

export const mapOverlaysView = new MapOverlaysViewStore();
