/**
 * habitatView.svelte.ts
 *
 * Shared reactive state for the Habitat tab — mirrors the Shiny inputs in
 * `quarto_components/_habitat.qmd` (habitatSelect/habitatBin/modelSelectHabitat/
 * scenarioSelectHabitat/periodSelectHabitat/habitatBinaryFull). No species
 * index here at all — habitat is one of 6 fixed types, not searched.
 */

import type { ScenarioCode, PeriodCode } from '$lib/data/species-catalogue.js';
import type { HabitatId, HabitatThreshold, PostTreatment } from '$lib/data/habitat-catalogue.js';

class HabitatViewStore {
	habitat = $state<HabitatId | null>(null);
	threshold = $state<HabitatThreshold>('p10');
	postTreatment = $state<PostTreatment>('std');
	scenario = $state<ScenarioCode>('current');
	period = $state<PeriodCode>('dec50');
	binary = $state(false);
}

export const habitatView = new HabitatViewStore();
