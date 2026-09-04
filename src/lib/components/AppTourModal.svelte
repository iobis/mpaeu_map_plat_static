<script lang="ts">
	/**
	 * AppTourModal.svelte
	 *
	 * A short, image-based guided tour of the app — new to this rewrite (the
	 * Shiny app had no such thing), reached via WelcomeModal's third card.
	 * Plain screenshots + captions rather than a real interactive walkthrough
	 * (e.g. highlighting live DOM elements): far less to build/maintain, and
	 * the screenshots (static/tour/*.png) can just be recaptured whenever the
	 * UI changes meaningfully, same as the README's own status screenshot.
	 */
	import { base } from '$app/paths';

	interface Props {
		open: boolean;
	}
	let { open = $bindable(false) }: Props = $props();

	interface Slide {
		image: string;
		title: string;
		caption: string;
	}

	const SLIDES: Slide[] = [
		{
			image: 'tour/01-overview.png',
			title: 'Map on the left, controls on the right',
			caption: 'Switch between the Species, Thermal range, and Habitat tabs — each drives what renders on the map.'
		},
		{
			image: 'tour/02-select-species.png',
			title: 'Search for a species',
			caption: 'Type a scientific or common name, then choose a model, scenario, and time period to render its distribution.'
		},
		{
			image: 'tour/03-compare.png',
			title: 'Compare current vs. a future scenario',
			caption: "Once you pick a non-current scenario, a \"Split map viewer\" toggle appears — drag the divider to compare the current and future predictions side by side."
		},
		{
			image: 'tour/04-overlays.png',
			title: 'Add spatial context',
			caption: 'Toggle Realms, EEZs, and MPA boundaries on top of any map — hover the ⓘ icons next to each for its data source.'
		},
		{
			image: 'tour/05-details-report.png',
			title: 'Dig deeper, or export a report',
			caption: '"Show additional details" surfaces model diagnostics (bias, extrapolation, raw model info); "Generate report" builds a full, printable PDF report for the selected species.'
		}
	];

	let step = $state(0);
	const last = SLIDES.length - 1;

	let modalEl = $state<HTMLDivElement>();
	// Same reasoning as WelcomeModal.svelte: opened programmatically from a
	// button inside another modal that's about to unmount, so focus must be
	// moved here explicitly for Escape/arrow-key navigation to reach us at all.
	$effect(() => {
		if (open) modalEl?.focus();
	});

	function close() {
		open = false;
		step = 0;
	}
	function next() {
		if (step >= last) close();
		else step += 1;
	}
	function prev() {
		if (step > 0) step -= 1;
	}
	function onKeydown(e: KeyboardEvent) {
		// Stop the bubble to .backdrop's own identical listener below — both
		// exist (the div-with-onclick a11y lint wants a keydown handler
		// alongside .modal's click-swallowing onclick), but a keydown fired on
		// the focused .modal would otherwise reach both, double-advancing/
		// -reversing the step on every press.
		e.stopPropagation();
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
	}
</script>

{#if open}
	<div class="backdrop" onclick={close} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="App tour"
			tabindex="-1"
			bind:this={modalEl}
			onclick={(e) => e.stopPropagation()}
			onkeydown={onKeydown}
		>
			<div class="modal-header">
				<h3>App tour</h3>
				<button type="button" class="close-btn" onclick={close} aria-label="Close">✕</button>
			</div>

			<div class="modal-body">
				<img class="slide-image" src="{base}/{SLIDES[step].image}" alt={SLIDES[step].title} />
				<h4 class="slide-title">{SLIDES[step].title}</h4>
				<p class="slide-caption">{SLIDES[step].caption}</p>
			</div>

			<div class="modal-footer">
				<div class="dots">
					{#each SLIDES as _, i (i)}
						<button type="button" class="dot" class:active={i === step} onclick={() => (step = i)} aria-label="Go to step {i + 1}"></button>
					{/each}
				</div>
				<div class="nav-btns">
					<button type="button" class="ghost-btn" onclick={prev} disabled={step === 0}>← Back</button>
					<button type="button" class="confirm-btn" onclick={next}>{step === last ? 'Done' : 'Next →'}</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.modal {
		width: min(680px, 94vw);
		max-height: 90vh;
		overflow-y: auto;
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
		/* See WelcomeModal.svelte — programmatic-only focus target. */
		outline: none;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.9rem 1.1rem;
		border-bottom: 1px solid #ebebeb;
	}
	.modal-header h3 {
		margin: 0;
		font-size: 1.05rem;
		color: #1cba92;
	}
	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 0.95rem;
		cursor: pointer;
		padding: 0.2rem;
		line-height: 1;
	}
	.close-btn:hover {
		color: #1e293b;
	}

	.modal-body {
		padding: 1.1rem;
	}
	.slide-image {
		width: 100%;
		height: auto;
		display: block;
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		background: #f6f6f6;
	}
	.slide-title {
		margin: 0.9rem 0 0.3rem;
		font-size: 0.9rem;
		color: #1e293b;
	}
	.slide-caption {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.6;
		color: #475569;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.1rem;
		border-top: 1px solid #ebebeb;
	}
	.dots {
		display: flex;
		gap: 0.4rem;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: #d4d4d4;
		padding: 0;
		cursor: pointer;
	}
	.dot.active {
		background: #1cba92;
	}
	.nav-btns {
		display: flex;
		gap: 0.5rem;
	}
	.ghost-btn {
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 6px;
		color: #475569;
		padding: 0.5rem 0.9rem;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ghost-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.confirm-btn {
		background: #1cba92;
		color: #ffffff;
		border: none;
		border-radius: 6px;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}
	.confirm-btn:hover {
		background: #17a07d;
	}
</style>
