import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { pluginIcon, readPluginManifests, type PluginManifestEntry } from './plugin-manifests';
import { PLUGIN_ICONS_DIR, PLUGIN_README_ICONS_DIR, PLUGINS_DIR } from './paths';

const README_PATH = resolve(PLUGINS_DIR, 'README.md');
const SITE_URL = 'https://unbound.rip';
const ICON_SIZE = 20;
const ICONS_PATH = relative(PLUGINS_DIR, PLUGIN_README_ICONS_DIR);

function oneLine(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

/**
 * @description Names a Discord icon's README SVG in kebab-case, such as `GlobeEarthIcon` to `globe-earth-icon.svg`.
 * @param icon The Discord icon name.
 * @returns The SVG file name.
 */
export function readmeIconFile(icon: string): string {
	const name = icon
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
		.replace(/_/g, '-')
		.toLowerCase();

	return `${name}.svg`;
}

function writeIfChanged(path: string, contents: string): void {
	if (existsSync(path) && readFileSync(path, 'utf8') === contents) return;

	writeFileSync(path, contents);
}

/**
 * @description Wraps a Discord icon PNG in an SVG that recolours it grey, so it reads on GitHub's light and dark themes.
 * @param pngBase64 The icon PNG, base64-encoded.
 * @returns The SVG markup.
 */
export function readmeIconSvg(pngBase64: string): string {
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24">`,
		'<filter id="grey"><feColorMatrix values="0 0 0 0 0.55 0 0 0 0 0.55 0 0 0 0 0.58 0 0 0 1 0"/></filter>',
		`<image width="24" height="24" filter="url(#grey)" href="data:image/png;base64,${pngBase64}"/>`,
		'</svg>',
		'',
	].join('\n');
}

/**
 * @description Renders the plugins README: one list item per plugin, with its icon, linked to its published store page.
 * A list rather than a table, so the formatter leaves the output as written.
 * @param plugins Each plugin's folder and manifest.
 * @returns The README markdown.
 */
export function renderReadme(plugins: PluginManifestEntry[]): string {
	const items = plugins
		.map(({ manifest }) => manifest)
		.toSorted((first, second) => first.name.localeCompare(second.name))
		.map(
			(manifest) =>
				`- <img src="${ICONS_PATH}/${readmeIconFile(pluginIcon(manifest))}" width="${ICON_SIZE}" height="${ICON_SIZE}" alt=""> [${oneLine(manifest.name)}](${SITE_URL}/addons/${manifest.id}): ${oneLine(manifest.description)}`,
		);

	return [
		'# Plugins',
		'',
		`${plugins.length} first-party plugins for Unbound. Install them from the [store](${SITE_URL}/plugins).`,
		'',
		'<!-- Generated from each manifest.json by `bun run plugins:readme`. Do not edit by hand. -->',
		'',
		...items,
		'',
	].join('\n');
}

function syncIcons(plugins: PluginManifestEntry[]): void {
	const icons = new Set(plugins.map(({ manifest }) => pluginIcon(manifest)));
	mkdirSync(PLUGIN_README_ICONS_DIR, { recursive: true });

	for (const icon of icons) {
		const pngPath = resolve(PLUGIN_ICONS_DIR, `${icon}.png`);
		if (!existsSync(pngPath))
			throw new Error(
				`Plugin icon ${icon} is missing; sync icons from the latest loader IPA.`,
			);

		const svg = readmeIconSvg(readFileSync(pngPath).toString('base64'));
		writeIfChanged(resolve(PLUGIN_README_ICONS_DIR, readmeIconFile(icon)), svg);
	}

	const files = new Set([...icons].map(readmeIconFile));

	for (const filename of readdirSync(PLUGIN_README_ICONS_DIR)) {
		if (!files.has(filename)) rmSync(resolve(PLUGIN_README_ICONS_DIR, filename));
	}
}

function main(): void {
	const plugins = readPluginManifests(PLUGINS_DIR);

	syncIcons(plugins);
	writeIfChanged(README_PATH, renderReadme(plugins));
}

if (import.meta.main) main();
