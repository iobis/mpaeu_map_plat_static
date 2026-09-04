/**
 * parquet-fetch.ts
 *
 * Fetches a parquet file's full bytes into memory and hands them to hyparquet
 * as a plain `ArrayBuffer`, rather than hyparquet's own `asyncBufferFromUrl()`
 * (a HEAD request for `Content-Length`, then HTTP Range requests for just the
 * footer/columns actually needed).
 *
 * That range-based approach breaks under GitHub Pages' CDN (Fastly): browsers
 * always send `Accept-Encoding: gzip`, GitHub Pages then serves `.parquet`
 * files gzip-compressed even though their `Content-Type` is
 * `application/octet-stream`, and:
 *   (a) the HEAD response's `Content-Length` reflects the *compressed* size,
 *       while `fetch()` transparently decompresses the body — so every
 *       footer-offset hyparquet computes from that reported byteLength lands
 *       in the wrong place, and
 *   (b) even a Range request against a gzip-compressed resource slices the
 *       *compressed* byte stream, not the logical file.
 * Both reliably produce hyparquet's "parquet file invalid (footer != PAR1)"
 * error — confirmed directly against the deployed site's response headers
 * (`content-encoding: gzip` present whenever the request advertises
 * `Accept-Encoding`, which browsers always do; absent, and everything works,
 * for a plain `curl` request that doesn't).
 *
 * Every file this app reads is small (species index ~1MB, per-species
 * metrics/occurrence files far smaller), so there's no real cost to just
 * downloading the whole thing — `ArrayBuffer` is hyparquet's own documented
 * stand-in for `AsyncBuffer` when the whole file is already in memory, and
 * using it here sidesteps the byteLength/Range ambiguity entirely, for this
 * CDN quirk or any other.
 */
export async function fetchParquetBuffer(url: string): Promise<ArrayBuffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
	return res.arrayBuffer();
}
