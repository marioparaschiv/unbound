import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PLUGIN_ICONS_DIR, PLUGINS_DIR } from './paths';

const pluginsDir = PLUGINS_DIR;
const iconsDir = PLUGIN_ICONS_DIR;
const iconRoots = [
	'Payload/Discord.app/assets/design/components/Icon/native/redesign/generated/images/',
	'Payload/Discord.app/assets/images/native/icons/',
];
const iconScales = ['@3x.png', '@2x.png', '.png'];

interface PluginManifest {
	id: string;
	icon?: string;
}

function readPluginIcons(): Set<string> {
	const icons = new Set<string>();

	for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const manifestPath = resolve(pluginsDir, entry.name, 'manifest.json');
		if (!existsSync(manifestPath)) continue;

		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PluginManifest;
		if (!manifest.icon) throw new Error(`Plugin ${manifest.id} is missing a manifest icon.`);
		if (!/^[A-Za-z0-9_-]+$/.test(manifest.icon))
			throw new Error(`Plugin ${manifest.id} has an invalid icon name: ${manifest.icon}.`);

		icons.add(manifest.icon);
	}

	return icons;
}

function findIconPath(icon: string, entries: Set<string>): string {
	for (const scale of iconScales) {
		for (const root of iconRoots) {
			const path = `${root}${icon}${scale}`;
			if (entries.has(path)) return path;
		}
	}

	throw new Error(`Could not find ${icon} in the latest loader IPA.`);
}

function readIconFiles(archivePath: string, icons: Set<string>): Map<string, Buffer> {
	const entries = new Set(
		execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
			.split(/\r?\n/)
			.filter(Boolean),
	);
	const files = new Map<string, Buffer>();

	for (const icon of icons) {
		const path = findIconPath(icon, entries);
		const contents = execFileSync('unzip', ['-p', archivePath, path], {
			maxBuffer: 16 * 1024 * 1024,
		});
		if (!contents.length)
			throw new Error(`The latest loader IPA contains an empty ${icon} asset.`);

		files.set(icon, contents);
	}

	return files;
}

function syncIcons(archivePath: string): void {
	if (!existsSync(archivePath)) throw new Error(`Loader IPA does not exist: ${archivePath}.`);

	const icons = readPluginIcons();
	const files = readIconFiles(archivePath, icons);
	mkdirSync(iconsDir, { recursive: true });

	for (const [icon, contents] of files) writeFileSync(resolve(iconsDir, `${icon}.png`), contents);

	for (const filename of readdirSync(iconsDir)) {
		if (
			filename.endsWith('.svg') ||
			(filename.endsWith('.png') && !icons.has(filename.slice(0, -4)))
		)
			rmSync(resolve(iconsDir, filename));
	}
}

const archivePath = process.argv[2];
if (!archivePath)
	throw new Error(
		'Usage: bun packages/plugin-scripts/src/sync-plugin-icons.ts <loader-ipa-path>',
	);

syncIcons(archivePath);
