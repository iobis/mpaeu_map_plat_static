/**
 * compare-sync.ts
 *
 * Minimal hand-rolled swipe divider + camera sync between two maplibregl.Map
 * instances sharing a container — the same UX as @maplibre/maplibre-gl-compare
 * (CSS `clip-path` on each map's container, camera mirrored via a
 * re-entrancy-guarded `move` handler), but self-contained.
 *
 * Uses `clip-path: inset(...)`, not the legacy `clip: rect(...)` property —
 * `clip` only takes effect on `position: absolute`/`fixed` elements per the
 * CSS2.1 spec, but the element it's set on here (`mapX.getContainer()`, i.e.
 * Map.svelte's own root div) is `position: relative`. Some Chromium builds
 * apply `clip` there anyway (non-standard leniency), which is why this can
 * look correct in one browser and silently no-op — leaving both maps fully
 * unclipped, so whichever mounts second/last simply paints over the other —
 * in another. `clip-path` has no such positioning requirement.
 *
 * Why not the npm package? Its `main` entry does `require("events")` (a Node
 * built-in with no browser polyfill in this project), its prebuilt browser
 * bundle doesn't expose a clean ESM default export under Vite's dependency
 * pre-bundler either way (tried both a dynamic and a static import against
 * it), and the actual logic is small enough (~60 lines) that reimplementing
 * it directly avoids fighting a 2021-era browserify bundle's packaging.
 */

import type maplibregl from 'maplibre-gl';

export interface CompareOptions {
	orientation?: 'vertical' | 'horizontal';
}

export interface CompareHandle {
	setSlider(position: number): void;
	remove(): void;
}

export function createCompare(
	mapA: maplibregl.Map,
	mapB: maplibregl.Map,
	container: HTMLElement,
	options: CompareOptions = {}
): CompareHandle {
	const horizontal = options.orientation === 'horizontal';

	const swiper = document.createElement('div');
	swiper.className = horizontal ? 'compare-swiper-horizontal' : 'compare-swiper-vertical';
	const controlContainer = document.createElement('div');
	controlContainer.className = horizontal ? 'maplibre-compare maplibre-compare-horizontal' : 'maplibre-compare';
	controlContainer.appendChild(swiper);
	container.appendChild(controlContainer);

	let bounds = mapB.getContainer().getBoundingClientRect();
	let currentPosition = (horizontal ? bounds.height : bounds.width) / 2;

	function setPosition(pos: number) {
		pos = Math.max(0, Math.min(pos, horizontal ? bounds.height : bounds.width));
		const transform = horizontal ? `translate(0, ${pos}px)` : `translate(${pos}px, 0)`;
		controlContainer.style.transform = transform;
		// clip-path, not the legacy `clip` property: `clip` only takes effect on
		// elements with position:absolute/fixed (CSS2.1 spec), but each map's own
		// container (Map.svelte's root div) is position:relative — so `clip` was
		// silently a no-op there in spec-compliant browsers (some Chromium builds
		// apply it anyway, which is why this could look correct in one browser
		// and render both panes as the *second* map, fully unclipped and
		// stacked on top, in another). clip-path has no such requirement.
		const clipA = horizontal ? `inset(0 0 ${bounds.height - pos}px 0)` : `inset(0 ${bounds.width - pos}px 0 0)`;
		const clipB = horizontal ? `inset(${pos}px 0 0 0)` : `inset(0 0 0 ${pos}px)`;
		mapA.getContainer().style.clipPath = clipA;
		mapB.getContainer().style.clipPath = clipB;
		currentPosition = pos;
	}
	setPosition(currentPosition);

	function pointOf(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
		return 'touches' in e ? e.touches[0] : e;
	}
	function onMove(e: MouseEvent | TouchEvent) {
		const p = pointOf(e);
		setPosition(horizontal ? p.clientY - bounds.top : p.clientX - bounds.left);
	}
	function onUp() {
		document.removeEventListener('mousemove', onMove);
		document.removeEventListener('mouseup', onUp);
		document.removeEventListener('touchmove', onMove);
		document.removeEventListener('touchend', onUp);
	}
	function onDown(e: Event) {
		if ('touches' in e) {
			document.addEventListener('touchmove', onMove);
			document.addEventListener('touchend', onUp);
		} else {
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
		}
	}
	swiper.addEventListener('mousedown', onDown);
	swiper.addEventListener('touchstart', onDown);

	function onResize() {
		bounds = mapB.getContainer().getBoundingClientRect();
		setPosition(currentPosition);
	}
	mapB.on('resize', onResize);

	// Camera sync, mirrored both ways, guarded against feedback loops (a
	// programmatic jumpTo triggers its own 'move' event, which would otherwise
	// re-trigger the other map's handler and recurse).
	let syncing = false;
	function mirror(from: maplibregl.Map, to: maplibregl.Map) {
		return () => {
			if (syncing) return;
			syncing = true;
			to.jumpTo({
				center: from.getCenter(),
				zoom: from.getZoom(),
				bearing: from.getBearing(),
				pitch: from.getPitch()
			});
			syncing = false;
		};
	}
	const aToB = mirror(mapA, mapB);
	const bToA = mirror(mapB, mapA);
	mapA.on('move', aToB);
	mapB.on('move', bToA);

	return {
		setSlider: setPosition,
		remove() {
			mapA.off('move', aToB);
			mapB.off('move', bToA);
			mapB.off('resize', onResize);
			onUp();
			mapA.getContainer().style.clipPath = '';
			mapB.getContainer().style.clipPath = '';
			swiper.removeEventListener('mousedown', onDown);
			swiper.removeEventListener('touchstart', onDown);
			controlContainer.remove();
		}
	};
}
