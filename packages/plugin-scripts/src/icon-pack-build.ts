import { getAssetPath, isAssetName } from '@unbound-app/contracts/addon-assets';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { AddonAsset } from '@unbound-app/types';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { readPluginManifest } from './plugin-manifests';

/** A file the pack's build commit adds, by path relative to the pack folder. */
export type IconPackFile = {
	path: string;
	contents: Uint8Array;
};

/** What publishing an icon pack ships: its manifest with every image listed, the index bundle and the images by content. */
export type IconPackBuild = {
	manifest: PublishedManifest;
	files: IconPackFile[];
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IMAGE = /^(?<name>.+?)(?:@(?<scale>[23])x)?\.png$/;
const SCALES = ['2', '3'] as const;
// `media/` holds the store page's banner and gallery, which are not icons.
const SKIPPED_DIRS = new Set(['assets', 'media', 'node_modules']);

function listImages(dir: string, prefix: string = ''): string[] {
	return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;

		if (entry.name.startsWith('.')) return [];

		if (entry.isDirectory()) {
			return prefix === '' && SKIPPED_DIRS.has(entry.name) ? [] : listImages(dir, path);
		}

		return prefix !== '' && entry.name.endsWith('.png') ? [path] : [];
	});
}

function readPngSize(path: string, bytes: Uint8Array): { width: number; height: number } {
	if (bytes.length < 24 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
		throw new Error(`${path} is not a PNG.`);
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * @description Builds an icon pack for publishing. Each `<Discord asset path>@<scale>x.png` under the pack becomes an
 * asset named by its path, stored by content beside the `main` bundle, which lists every image path.
 * @param dir The pack folder, holding `manifest.json`.
 * @returns The build, or `undefined` when the folder's manifest is not an icon pack.
 */
export function buildIconPack(dir: string): IconPackBuild | undefined {
	const manifestPath = join(dir, 'manifest.json');

	if (!existsSync(manifestPath)) return;

	const manifest = readPluginManifest(manifestPath);

	if (manifest.type !== 'icon-pack') return;

	const { main } = manifest;
	const assets: Record<string, AddonAsset> = {};
	const files = new Map<string, Uint8Array>();
	const paths = listImages(dir).sort();

	for (const path of paths) {
		const match = IMAGE.exec(path);
		const name = match?.groups?.name;

		if (!name || !isAssetName(name)) {
			throw new Error(`${join(dir, path)} does not name a Discord asset.`);
		}

		const contents = readFileSync(join(dir, path));
		const scale = SCALES.find((value) => value === match.groups?.scale) ?? '1';
		const sha256 = createHash('sha256').update(contents).digest('hex');
		const size = readPngSize(join(dir, path), contents);
		const asset = (assets[name] ??= {
			type: 'png',
			width: Math.max(1, Math.round(size.width / Number(scale))),
			height: Math.max(1, Math.round(size.height / Number(scale))),
			scales: {},
		});

		asset.scales[scale] = sha256;
		files.set(getAssetPath(main, sha256, 'png'), contents);
	}

	if (paths.length === 0) {
		throw new Error(`${dir} has no PNG images.`);
	}

	const bundle = new TextEncoder().encode(`${JSON.stringify(paths)}\n`);

	return {
		manifest: { ...manifest, assets },
		files: [
			{ path: main, contents: bundle },
			...[...files].map(([path, contents]) => ({ path, contents })),
		],
	};
}

export default { buildIconPack };
