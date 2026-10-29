import { Resvg } from '@resvg/resvg-js';
import type { Plugin } from 'vite';

import {
	ADDON_ICON_NAMES,
	ATLAS_COLUMNS,
	ATLAS_PITCH,
	buildAddonIconAtlas,
} from '../src/lib/addon-icons';
import encodeGrayPng from './encode-gray-png';

const MODULE_ID = 'virtual:addon-icon-atlas';
const RESOLVED_ID = `\0${MODULE_ID}`;

/** Pixels per icon unit: a 20-unit icon at 20px on a 2x screen. */
export const ATLAS_SCALE = 2;

// A bitmap, not the SVG: browsers repaint an SVG image for every element it masks.
function renderAtlas(): Buffer {
	const { width, height, pixels } = new Resvg(buildAddonIconAtlas(), {
		fitTo: { mode: 'zoom', value: ATLAS_SCALE },
	}).render();
	const coverage = new Uint8Array(width * height);

	for (let i = 0; i < coverage.length; i++) {
		coverage[i] = pixels[i * 4 + 3] ?? 0;
	}

	return encodeGrayPng(coverage, width, height);
}

/**
 * @description Serves every addon icon on one content-hashed greyscale PNG atlas under `/assets/`,
 * which the server caches immutably, for use as a luminance mask. `virtual:addon-icon-atlas` exports
 * its URL, the same in every environment, the icon names in atlas order and the grid's layout.
 * @returns The Vite plugin.
 */
function addonIconAtlas(): Plugin {
	const atlas = renderAtlas();
	const hash = new Bun.CryptoHasher('sha256').update(atlas).digest('hex').slice(0, 12);
	const fileName = `assets/addon-icons-${hash}.png`;
	const code = [
		`export default '/${fileName}';`,
		`export const names = ${JSON.stringify(ADDON_ICON_NAMES)};`,
		`export const columns = ${ATLAS_COLUMNS};`,
		`export const pitch = ${ATLAS_PITCH};`,
	].join('\n');

	return {
		name: 'unbound:addon-icon-atlas',
		resolveId: (id) => (id === MODULE_ID ? RESOLVED_ID : undefined),
		load: (id) => (id === RESOLVED_ID ? code : undefined),
		configureServer(server) {
			server.middlewares.use(`/${fileName}`, (_request, response) => {
				response.setHeader('content-type', 'image/png');
				response.setHeader('cache-control', 'public, max-age=31536000, immutable');
				response.end(atlas);
			});
		},
		generateBundle() {
			// Only the client build ships files to browsers; the server build only needs the URL.
			if (this.environment.name !== 'client') return;

			this.emitFile({ type: 'asset', fileName, source: atlas });
		},
	};
}

export default addonIconAtlas;
