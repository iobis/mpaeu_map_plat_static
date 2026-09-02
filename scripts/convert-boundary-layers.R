#!/usr/bin/env Rscript
#
# convert-boundary-layers.R
#
# One-off/occasionally-rerun data-prep script — NOT part of the SvelteKit
# build. Converts the two local vector files the Shiny app reads directly
# into memory at server start (components/serverstart.R) into FlatGeobuf,
# so the static site can fetch and stream them client-side the same way
# DeckOverlay.svelte already does for the Atlas layers:
#   - data/MarineRealms_BO.shp        (Costello et al. 2017 marine realms)
#   - data/EEZ_IHO_simp_edited.parquet (Flanders Marine Institute EEZ/IHO
#     intersect, via marineregions.org)
#
# Usage: Rscript scripts/convert-boundary-layers.R \
#   /path/to/mpaeu_map_platform/data/MarineRealms_BO.shp \
#   /path/to/mpaeu_map_platform/data/EEZ_IHO_simp_edited.parquet

library(sf)
library(sfarrow)

args <- commandArgs(trailingOnly = TRUE)
realms_path <- if (length(args) >= 1) args[1] else "../mpaeu_map_platform/data/MarineRealms_BO.shp"
eez_path <- if (length(args) >= 2) args[2] else "../mpaeu_map_platform/data/EEZ_IHO_simp_edited.parquet"

dir.create("static/data", recursive = TRUE, showWarnings = FALSE)

# Realms — mirrors components/mapreactive.R's realms handling. The only
# attribute is a numeric `Realm` ID (1-30), no name field in this file, so
# the rewrite can't show a nicer popup label than the original did either.
realms <- st_read(realms_path, quiet = TRUE)
realms <- st_transform(realms, 4326)
realms_out <- "static/data/realms.fgb"
if (file.exists(realms_out)) file.remove(realms_out)
st_write(realms, realms_out, driver = "FlatGeobuf", quiet = TRUE)
cat(sprintf("Wrote %d realm polygons to %s (%.1f KB)\n", nrow(realms), realms_out, file.info(realms_out)$size / 1024))

# EEZ — mirrors components/mapreactive.R's EEZ handling. Columns MRGID +
# EEZ (name string, e.g. "Albanian Exclusive Economic Zone"). A handful of
# rows carry a NULL geometry (verified: not a conversion artifact — same
# rows are empty in the source parquet) which FlatGeobuf's spatial index
# can't store, so those are dropped rather than worked around.
eez <- st_read_parquet(eez_path)
n_before <- nrow(eez)
eez <- eez[!is.na(st_dimension(eez)), ]
if (nrow(eez) < n_before) cat(sprintf("Dropped %d EEZ feature(s) with a NULL geometry\n", n_before - nrow(eez)))
eez <- st_transform(eez, 4326)
eez_out <- "static/data/eez.fgb"
if (file.exists(eez_out)) file.remove(eez_out)
st_write(eez, eez_out, driver = "FlatGeobuf", quiet = TRUE)
cat(sprintf("Wrote %d EEZ polygons to %s (%.1f KB)\n", nrow(eez), eez_out, file.info(eez_out)$size / 1024))
