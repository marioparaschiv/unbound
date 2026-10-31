import {
	validateAddonCapabilities,
	validateAddonFolder,
	validateAddonNaming,
	type ConventionManifest,
} from '@unbound-app/contracts/addon-conventions';
import { formatChangelogIssues, parseChangelog } from '@unbound-app/contracts/changelog';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { PLUGINS_DIR } from './paths';

const DISCORD_TEXT_INPUT = '<Discord.TextInput';
const IGNORED_TEXT_INPUT_PROPS: Record<string, string> = {
	title: 'label',
	helpText: 'description',
};

type PluginManifest = ConventionManifest & {
	authors?: unknown;
	version?: unknown;
	main?: unknown;
};

function isManifestObject(value: unknown): value is PluginManifest {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validatePluginFolder(folder: string, manifest: unknown): string[] {
	if (!isManifestObject(manifest)) {
		return [...validateAddonFolder(folder), 'manifest must be an object'];
	}

	const errors = validateAddonNaming(manifest, folder);

	if (!Array.isArray(manifest.authors) || manifest.authors.length === 0)
		errors.push('authors must be a non-empty array');
	if (typeof manifest.version !== 'string' || !manifest.version.trim())
		errors.push('version must be a non-empty string');
	if (typeof manifest.main !== 'string' || !manifest.main.trim())
		errors.push('main must be a non-empty string');

	return [...errors, ...validateAddonCapabilities(manifest)];
}

/**
 * @description Checks that a plugin ships an ADDON.md and a CHANGELOG.md with an entry for its version.
 * @param pluginDirectory The plugin's folder.
 * @param version The manifest's version, or `undefined` when the manifest has none.
 * @returns Every problem found, empty when the docs are in order.
 */
export function validatePluginDocs(pluginDirectory: string, version: string | undefined): string[] {
	const errors: string[] = [];
	const addonPath = join(pluginDirectory, 'ADDON.md');
	const changelogPath = join(pluginDirectory, 'CHANGELOG.md');

	if (!existsSync(addonPath)) errors.push('ADDON.md is missing');
	else if (!readFileSync(addonPath, 'utf8').trim()) errors.push('ADDON.md is empty');

	if (!existsSync(changelogPath)) return [...errors, 'CHANGELOG.md is missing'];

	const parsed = parseChangelog(readFileSync(changelogPath, 'utf8'));
	for (const issue of parsed.issues) errors.push(formatChangelogIssues([issue]));

	if (parsed.issues.length === 0 && version?.trim() && !parsed.releases.has(version)) {
		errors.push(`CHANGELOG.md has no entry for ${version}`);
	}

	return errors;
}

function openingTag(source: string, start: number): string {
	let depth = 0;

	for (let index = start; index < source.length; index++) {
		const character = source[index];

		if (character === '{') depth++;
		else if (character === '}') depth--;
		else if (character === '>' && depth === 0) return source.slice(start, index + 1);
	}

	return source.slice(start);
}

export function validateTextInputProps(source: string): string[] {
	const errors: string[] = [];

	for (
		let start = source.indexOf(DISCORD_TEXT_INPUT);
		start !== -1;
		start = source.indexOf(DISCORD_TEXT_INPUT, start + 1)
	) {
		const tag = openingTag(source, start);
		const line = source.slice(0, start).split('\n').length;

		for (const [prop, replacement] of Object.entries(IGNORED_TEXT_INPUT_PROPS)) {
			if (new RegExp(`\\s${prop}=`).test(tag)) {
				errors.push(
					`line ${line}: Discord.TextInput ignores ${prop}, use ${replacement} instead`,
				);
			}
		}
	}

	return errors;
}

function sourceFiles(directory: string): string[] {
	if (!existsSync(directory)) return [];

	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) return sourceFiles(path);

		return /\.[jt]sx$/.test(entry.name) ? [path] : [];
	});
}

export function validatePluginSources(pluginDirectory: string): string[] {
	return sourceFiles(join(pluginDirectory, 'src')).flatMap((file) =>
		validateTextInputProps(readFileSync(file, 'utf8')).map(
			(error) => `${relative(pluginDirectory, file)} ${error}`,
		),
	);
}

/**
 * @description Checks that rollup.config.mjs sets `settingsPanel: true` exactly when the entry file exports `getSettingsPanel`.
 * @param pluginDirectory The plugin's folder.
 * @returns The mismatch found, empty when the flag and the entry file agree.
 */
export function validateSettingsPanel(pluginDirectory: string): string[] {
	const configPath = join(pluginDirectory, 'rollup.config.mjs');
	const entryPath = ['index.tsx', 'index.ts']
		.map((name) => join(pluginDirectory, 'src', name))
		.find((path) => existsSync(path));

	if (!existsSync(configPath) || !entryPath) return [];

	const flagged = /\bsettingsPanel:\s*true\b/.test(readFileSync(configPath, 'utf8'));
	const exported = /\bgetSettingsPanel\b/.test(readFileSync(entryPath, 'utf8'));

	if (flagged === exported) return [];

	return [
		exported
			? 'rollup.config.mjs must set settingsPanel: true because src/index exports getSettingsPanel'
			: 'rollup.config.mjs sets settingsPanel: true but src/index does not export getSettingsPanel',
	];
}

export function validatePluginDirectory(pluginsDirectory: string): string[] {
	const errors: string[] = [];
	const ids = new Map<string, string>();
	const names = new Map<string, string>();

	for (const entry of readdirSync(pluginsDirectory, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const folder = entry.name;
		const pluginDirectory = join(pluginsDirectory, folder);
		const manifestPath = join(pluginDirectory, 'manifest.json');
		const hasPluginSource =
			existsSync(join(pluginDirectory, 'src')) ||
			existsSync(join(pluginDirectory, 'package.json')) ||
			existsSync(manifestPath);
		if (!hasPluginSource) continue;
		if (!existsSync(manifestPath)) {
			errors.push(`${folder}: manifest.json is missing`);
			continue;
		}

		let manifest: unknown;
		try {
			manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		} catch (error) {
			errors.push(`${folder}: manifest.json is invalid JSON (${String(error)})`);
			continue;
		}

		for (const error of validatePluginFolder(folder, manifest))
			errors.push(`${folder}: ${error}`);

		const version = isManifestObject(manifest) ? manifest.version : undefined;

		for (const error of validatePluginDocs(
			pluginDirectory,
			typeof version === 'string' ? version : undefined,
		))
			errors.push(`${folder}: ${error}`);

		for (const error of validatePluginSources(pluginDirectory))
			errors.push(`${folder}: ${error}`);

		for (const error of validateSettingsPanel(pluginDirectory))
			errors.push(`${folder}: ${error}`);

		if (isManifestObject(manifest)) {
			const data = manifest;
			if (typeof data.id === 'string') {
				const previous = ids.get(data.id);
				if (previous)
					errors.push(`${folder}: id ${data.id} is already used by ${previous}`);
				else ids.set(data.id, folder);
			}
			if (typeof data.name === 'string') {
				const previous = names.get(data.name);
				if (previous)
					errors.push(`${folder}: name ${data.name} is already used by ${previous}`);
				else names.set(data.name, folder);
			}
		}
	}

	return errors;
}

export function main(): void {
	const errors = validatePluginDirectory(PLUGINS_DIR);
	if (errors.length === 0) {
		console.log('Plugin naming and manifest validation passed.');
		return;
	}

	console.error(errors.map((error) => `- ${error}`).join('\n'));
	process.exitCode = 1;
}

if (import.meta.main) main();
