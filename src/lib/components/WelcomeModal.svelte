<script lang="ts">
	/**
	 * WelcomeModal.svelte
	 *
	 * Ports the Shiny app's `shinyalert("Welcome", ...)` (components/maprenders.R)
	 * — shown unconditionally on every page load, no dismissal persistence, just
	 * like the original. Two of its three cards are the original's own external
	 * links (verbatim text/URLs); the third is new to this rewrite — an in-app
	 * guided tour (AppTourModal.svelte) rather than a link, so it gets a
	 * different accent colour and no "external link" glyph.
	 */
	interface Props {
		open: boolean;
		onTour: () => void;
	}
	let { open = $bindable(false), onTour }: Props = $props();

	let modalEl = $state<HTMLDivElement>();
	// This modal opens on its own (no prior click to anchor focus), so without
	// this, Escape/keyboard never reaches its keydown handler at all — nothing
	// in the document has focus inside it for the keydown to bubble from.
	// One retry on the next frame: SvelteKit's own client router blurs
	// whatever's focused as part of completing a navigation — including the
	// very first page load — via a bare `document.activeElement.blur()` in
	// its client runtime, which otherwise steals focus back a moment after
	// this modal grabs it.
	$effect(() => {
		if (!open) return;
		modalEl?.focus();
		const raf = requestAnimationFrame(() => modalEl?.focus());
		return () => cancelAnimationFrame(raf);
	});

	function close() {
		open = false;
	}
	function startTour() {
		open = false;
		onTour();
	}
	function onKeydown(e: KeyboardEvent) {
		// Stop the bubble to .backdrop's own identical listener below — both
		// exist (the div-with-onclick a11y lint wants a keydown handler
		// alongside .modal's click-swallowing onclick), but a keydown fired on
		// the focused .modal would otherwise reach both, running this twice.
		e.stopPropagation();
		if (e.key === 'Escape') close();
	}
</script>

{#if open}
	<div class="backdrop" onclick={close} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="Welcome"
			tabindex="-1"
			bind:this={modalEl}
			onclick={(e) => e.stopPropagation()}
			onkeydown={onKeydown}
		>
			<div class="modal-header">
				<h3>Welcome</h3>
				<button type="button" class="close-btn" onclick={close} aria-label="Close">✕</button>
			</div>
			<div class="modal-body">
				<p class="intro">
					Welcome to the MPA Europe map platform. Here, you can explore species and habitat range maps developed for the
					<a href="https://mpa-europe.eu/" target="_blank" rel="noopener">MPA Europe project</a>.
				</p>

				<div class="cards">
					<a class="card" style="--accent:#184e77" href="https://iobis.github.io/mpaeu_docs/understanding.html" target="_blank" rel="noopener">
						<span class="card-icon" aria-hidden="true">💡</span>
						<span class="card-text">
							<span class="card-title">Learn how to interpret range maps <span class="ext" aria-hidden="true">↗</span></span>
							<span class="card-desc">Species distribution models (SDMs) are valuable tools, but it's important to understand how to interpret their results correctly.</span>
						</span>
					</a>

					<a class="card" style="--accent:#1e6091" href="https://iobis.github.io/mpaeu_docs/" target="_blank" rel="noopener">
						<span class="card-icon" aria-hidden="true">📖</span>
						<span class="card-text">
							<span class="card-title">Read the documentation <span class="ext" aria-hidden="true">↗</span></span>
							<span class="card-desc">Explore the full details of the framework used to produce the range maps.</span>
						</span>
					</a>

					<button type="button" class="card" style="--accent:#1cba92" onclick={startTour}>
						<span class="card-icon" aria-hidden="true">🧭</span>
						<span class="card-text">
							<span class="card-title">Take a tour of the app</span>
							<span class="card-desc">New here? Get a quick guided walkthrough of the map, tabs, and this rewrite's new comparison and reporting tools.</span>
						</span>
					</button>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="confirm-btn" onclick={close}>Go to the maps</button>
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
		width: min(640px, 94vw);
		max-height: 90vh;
		overflow-y: auto;
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
		/* This container is only focused programmatically (to route Escape/etc.
		   keydowns), not a real interactive control — its own focus ring isn't
		   meaningful; the actual cards/buttons inside keep theirs. */
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
		color: #184e77;
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
	.intro {
		font-size: 0.82rem;
		line-height: 1.6;
		color: #334155;
		margin: 0 0 1rem;
	}
	.intro a {
		color: #006cd7;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.card {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		/* width: 100%; */
		text-align: left;
		background: #ffffff;
		border: 1px solid #bcbcbc;
		border-radius: 10px;
		padding: 0.75rem 0.9rem;
		text-decoration: none;
		cursor: pointer;
		font: inherit;
		transition: background 0.15s;
	}
	.card:hover {
		background: #f0f0f0;
	}
	.card-icon {
		font-size: 1.6rem;
		flex-shrink: 0;
		line-height: 1;
		margin-top: 0.1rem;
	}
	.card-text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.card-title {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--accent);
	}
	.card-title .ext {
		font-size: 0.72rem;
		color: #b2b2b2;
		font-weight: 400;
	}
	.card-desc {
		font-size: 0.74rem;
		color: #475569;
		line-height: 1.5;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		padding: 0.85rem 1.1rem;
		border-top: 1px solid #ebebeb;
	}
	.confirm-btn {
		background: #184e77;
		color: #ffffff;
		border: none;
		border-radius: 6px;
		padding: 0.5rem 1.1rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}
	.confirm-btn:hover {
		background: #143f61;
	}
</style>
