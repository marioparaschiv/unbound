import { ASSET_SCALES, getAssetPath } from '@unbound-app/contracts/addon-assets';
import type { AddonManifest } from '@unbound-app/types';

/** One icon a pack draws: its file, relative to the pack folder, and the scale it was drawn at. */
export type PackIcon = {
	path: string;
	scale: number;
};

/** An image in a GitHub pack's tree: the asset path, an optional `@Nx` scale, and its type. */
const IMAGE_FILE = /^(.+?)(?:@(\d)x)?\.(?:png|jpe?g|webp|gif)$/;

const HIGHEST_FIRST = [...ASSET_SCALES].reverse();

/**
 * @description Lists a store pack's icons from its manifest, one per distinct image at its highest scale.
 * @param manifest The pack's manifest, whose `assets` name each image by content.
 * @returns The icons, in manifest order; assets drawn by the same image share one entry.
 */
export function listedIcons(manifest: AddonManifest): PackIcon[] {
	const icons = new Map<string, PackIcon>();

	for (const listed of Object.values(manifest.assets ?? {})) {
		const scale = HIGHEST_FIRST.find((key) => listed.scales[key]);
		const sha256 = scale && listed.scales[scale];

		if (scale && sha256) {
			const path = getAssetPath(manifest.main, sha256, listed.type);

			icons.set(path, { path, scale: Number(scale) });
		}
	}

	return [...icons.values()];
}

/**
 * @description Lists a GitHub pack's icons from the files it downloaded, one per asset at its highest scale.
 * @param paths The pack's files, relative to its folder.
 * @returns The icons, in file order.
 */
export function indexedIcons(paths: Iterable<string>): PackIcon[] {
	const icons = new Map<string, PackIcon>();

	for (const path of paths) {
		const match = IMAGE_FILE.exec(path);

		if (!match) {
			continue;
		}

		const scale = Number(match[2] ?? 1);
		const current = icons.get(match[1]);

		if (!current || scale > current.scale) {
			icons.set(match[1], { path, scale });
		}
	}

	return [...icons.values()];
}
