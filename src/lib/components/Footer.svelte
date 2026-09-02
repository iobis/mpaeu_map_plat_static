<script lang="ts">
	/**
	 * Footer.svelte
	 *
	 * Same content as quarto_components/_footer.qmd in the Shiny app (methods
	 * blurb + "how to cite" + MPA Europe project/funding band), reproduced
	 * close to verbatim since the citation text is meant to be quoted exactly.
	 * Styled to match: the methods section stays light (`#f6f6f6`, like
	 * Shiny's `.methods-div`), and the project/funding band keeps Shiny's
	 * dark blue (`#184e77` — also Atlas's own body-text blue, so it isn't a
	 * one-off colour) rather than the lighter Atlas palette used everywhere
	 * else, because the OBIS logo asset is white-on-transparent and only
	 * reads correctly against a dark background (checked by rendering it on
	 * both before picking this).
	 */
	import { base } from '$app/paths';
</script>

<footer class="site-footer">
	<div class="methods">
		<h3>How models were created?</h3>
		<p>
			Models were created using a point-process framework. Details on the modelling framework adopted by MPA Europe, including the full
			documentation, are available <a href="https://iobis.github.io/mpaeu_docs/" target="_blank" rel="noopener">in this link</a>.
		</p>

		<h3>How should I use this information?</h3>
		<p>
			Species Distribution Models (SDMs) provide valuable insights for both research and conservation efforts. These maps depict the relative
			and potential suitability of habitats for a particular species, aiding researchers and conservationists in understanding where a species
			could potentially occur. It is important to note that SDMs show suitability rather than presence, meaning the species may not actually
			occur throughout the entire extent indicated on the map. Additionally, there is inherent uncertainty associated with all SDM maps,
			stemming from various factors such as data quality, model assumptions, and environmental variability. Therefore, while SDMs offer
			valuable information, their results should be interpreted critically, considering the limitations and uncertainties associated with the
			models.
		</p>

		<h3>How to cite</h3>
		<p>When using data from this platform, please cite it as follows:</p>
		<p class="citation">
			Ocean Biodiversity Information System (OBIS). (2024). Species distribution dashboard for MPA Europe. (version 0.1.0). <a
				href="https://shiny.obis.org/distmaps"
				target="_blank"
				rel="noopener">https://shiny.obis.org/distmaps</a
			>. Zenodo.
			<a href="https://doi.org/10.5281/zenodo.14524781" target="_blank" rel="noopener">https://doi.org/10.5281/zenodo.14524781</a>
		</p>
	</div>

	<div class="project-band">
		<h3>MPA Europe project</h3>
		<p class="project-desc">
			Using a holistic range of measures that include the range of biodiversity from species to ecosystems, including habitats, areas will be
			prioritised using systematic conservation planning software. This enables alternative weighting of variables and multiple scenarios and
			thus support wider marine spatial planning.
		</p>

		<div class="project-grid">
			<div class="explore">
				<h4>Explore more</h4>
				<a href="https://mpa-europe.eu/" target="_blank" rel="noopener">› MPA Europe</a>
				<a href="https://obis.org" target="_blank" rel="noopener">› OBIS</a>
				<p class="credit">Product created by the <a href="https://obis.org" target="_blank" rel="noopener">Ocean Biodiversity Information System</a></p>
				<img src="{base}/images/obis_logo.png" alt="OBIS" class="obis-logo" />
			</div>

			<div class="support">
				<h4>Support</h4>
				<p>
					Grant Agreement 101059988 – MPA Europe. MPA Europe project has been approved under HORIZON-CL6-2021-BIODIV-01-12 — Improved
					science based maritime spatial planning and identification of marine protected areas.
				</p>
				<p>
					Co-funded by the European Union. Views and opinions expressed are however those of the authors only and do not necessarily
					reflect those of the European Union or UK Research and Innovation. Neither the European Union nor the granting authority can be
					held responsible for them.
				</p>
				<img src="{base}/images/euuk_logo.png" alt="Co-funded by the European Union — UK Research and Innovation" class="euuk-logo" />
			</div>
		</div>

		<div class="license-line">
			All data shown in this website is under a CC-0 licence. See project status
			<a href="https://github.com/iobis/mpaeu_map_platform/blob/main/NEWS.md" target="_blank" rel="noopener">here</a>.
		</div>
	</div>
</footer>

<style>
	.site-footer {
		margin-top: 1.5rem;
		font-size: 0.8rem;
	}

	.methods {
		background: #f6f6f6;
		border-top: 1px solid #d8d8d8;
		padding: 1.5rem 1.75rem;
	}
	.methods h3 {
		font-size: 0.85rem;
		font-weight: 700;
		color: #006cd7;
		margin: 1.1rem 0 0.4rem;
	}
	.methods h3:first-child {
		margin-top: 0;
	}
	.methods p {
		font-size: 0.75rem;
		color: #475569;
		line-height: 1.6;
		margin: 0 0 0.4rem;
		max-width: 900px;
	}
	.methods a {
		color: #006cd7;
	}
	.citation {
		font-style: italic;
	}

	.project-band {
		background: #184e77;
		color: #ffffff;
		padding: 1.5rem 1.75rem 0.75rem;
	}
	.project-band h3 {
		font-size: 0.9rem;
		font-weight: 700;
		margin: 0 0 0.5rem;
	}
	.project-desc {
		font-size: 0.75rem;
		line-height: 1.6;
		color: #dbeafe;
		max-width: 900px;
		margin: 0 0 1.25rem;
	}

	.project-grid {
		display: grid;
		grid-template-columns: 1fr 3fr;
		gap: 1.5rem;
	}
	@media (max-width: 700px) {
		.project-grid {
			grid-template-columns: 1fr;
		}
	}

	.project-grid h4 {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #b2edfa;
		margin: 0 0 0.5rem;
	}
	.explore a {
		display: block;
		color: #ffffff;
		font-size: 0.75rem;
		text-decoration: none;
		margin-bottom: 0.3rem;
	}
	.explore a:hover {
		text-decoration: underline;
	}
	.credit {
		font-size: 0.68rem;
		color: #b8c9d9;
		line-height: 1.5;
		margin: 0.4rem 0 0.6rem;
	}
	.credit a {
		color: #b2edfa;
	}
	.obis-logo {
		width: 140px;
		max-width: 100%;
		height: auto;
	}

	.support p {
		font-size: 0.7rem;
		color: #cbd8e4;
		line-height: 1.6;
		margin: 0 0 0.6rem;
		max-width: 700px;
	}
	.euuk-logo {
		width: 220px;
		max-width: 100%;
		height: auto;
		border-radius: 4px;
		margin-top: 0.2rem;
	}

	.license-line {
		font-size: 0.6rem;
		color: #9db8ce;
		text-align: center;
		padding: 0.9rem 0 0.7rem;
		margin-top: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}
	.license-line a {
		color: #b2edfa;
	}
</style>
