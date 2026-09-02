#!/usr/bin/env Rscript
#
# build-species-index.R
#
# One-off/occasionally-rerun data-prep script — NOT part of the SvelteKit
# build. Reproduces the species-list load in mpaeu_map_platform's
# components/serverstart.R (lines 82-112): read the full species metadata
# table, restrict it to species that actually have model output (present in
# species_db.parquet), sort by scientificName. Additionally dedupes on
# taxonID (the source table has ~38 exact-duplicate rows — a pipeline
# artifact upstream, not meaningful signal) and keeps only the columns the
# static site's search + filter UI actually uses.
#
# Also folds in `available_models` from species_db.parquet (comma-joined,
# ordered by a fixed method priority) so the static site never needs a
# per-species network round-trip just to know which model methods exist —
# confirmed empirically (see conversation history) that every other
# per-species asset (mask/fitocc/log/thresholds/thermenvelope, and the full
# current+5-scenario×2-period prediction grid for every available method) is
# universally present across all 12,039 available species, so URL
# generation for those stays a pure function (species-catalogue.ts) with no
# existence lookup needed.
#
# Output: static/data/species-index.parquet, fetched client-side once and
# read with hyparquet (see src/lib/data/species-index-loader.ts) — no
# backend involved, this stays fully static.
#
# Usage: Rscript scripts/build-species-index.R \
#   /path/to/mpaeu_map_platform/data/app_splist.rds \
#   /path/to/mpaeu_map_platform/data/species_db.parquet

library(arrow)
library(dplyr)

args <- commandArgs(trailingOnly = TRUE)
splist_path <- if (length(args) >= 1) args[1] else "../mpaeu_map_platform/data/app_splist.rds"
species_db_path <- if (length(args) >= 2) args[2] else "../mpaeu_map_platform/data/species_db.parquet"
out_path <- "static/data/species-index.parquet"

speciesinfo <- readRDS(splist_path)
speciesinfo <- speciesinfo[order(speciesinfo$scientificName), ]

available_ids <- open_dataset(species_db_path) |>
	select(taxonid) |>
	distinct() |>
	collect() |>
	pull(taxonid)

speciesinfo <- speciesinfo[speciesinfo$taxonID %in% as.numeric(available_ids), ]
speciesinfo <- speciesinfo[!duplicated(speciesinfo$taxonID), ]

# Method priority mirrors the Shiny app's "best available" preference
# (ensemble > maxent > rf > xgboost), with esm appended last since it only
# ever appears alone (it's the fallback for data-poor species that can't
# support the full 4-algorithm ensemble — never co-occurs with the others).
method_priority <- c("ensemble", "maxent", "rf", "xgboost", "esm")
methods_by_species <- open_dataset(species_db_path) |>
	select(taxonid, available_models) |>
	collect() |>
	tidyr::unnest(available_models) |>
	dplyr::mutate(method = factor(method, levels = method_priority)) |>
	dplyr::arrange(taxonid, method) |>
	dplyr::group_by(taxonid) |>
	dplyr::summarise(available_methods = paste(method, collapse = ","))

speciesinfo <- merge(speciesinfo, methods_by_species,
	by.x = "taxonID", by.y = "taxonid", all.x = TRUE)
speciesinfo <- speciesinfo[order(speciesinfo$scientificName), ]

out <- data.frame(
	taxonID = as.integer(speciesinfo$taxonID),
	scientificName = speciesinfo$scientificName,
	commonNames = speciesinfo$common_names,
	group = speciesinfo$sdm_group,
	regionName = speciesinfo$region_name,
	phylum = speciesinfo$phylum,
	class = speciesinfo$class,
	order = speciesinfo$order,
	family = speciesinfo$family,
	redlistCategory = speciesinfo$redlist_category,
	study = speciesinfo$study,
	availableMethods = speciesinfo$available_methods,
	stringsAsFactors = FALSE
)

dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
write_parquet(out, out_path)

cat(sprintf("Wrote %d species to %s (%.1f KB)\n", nrow(out), out_path, file.info(out_path)$size / 1024))
