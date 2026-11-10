import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

import type { AddonAuthor, AddonManifest } from '../src/global';
import type { LocaleTable } from './fake-locales';
import type { AnyObject } from '../src/patcher';

import { ASSETS_DIRECTORY, ASSET_SCALES } from '../src/_conventions/addon-assets';
import { LOCALES_DIRECTORY } from '../src/_conventions/addon-locales';

const ENTRY_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

// The `@2x` and `@3x` an image's file name ends in at each scale above 1.
const SCALE_SUFFIXES = ASSET_SCALES.filter((scale) => scale !== '1').map((scale) => `@${scale}x`);

function isRecord(value: unknown): value is AnyObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// UNKNOWN: a JSON file holds anything; each caller narrows it with a guard.
function readJson(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`Failed to read ${path}: ${(error as Error).message}`, { cause: error });
	}
}

function nearestManifest(from: string): string | undefined {
	for (let dir = resolve(from); ; dir = dirname(dir)) {
		if (existsSync(join(dir, 'manifest.json'))) {
			return dir;
		}

		if (dirname(dir) === dir) return;
	}
}

/**
 * @description Finds the plugin under test: `UNBOUND_PLUGIN_ROOT`, else the folder holding the nearest
 * `manifest.json` above the first test file, else above the working directory.
 * @param testFile The first test file bun runs, `Bun.main`.
 * @returns The plugin's directory; throws when there is no manifest above either.
 */
export function findPluginRoot(testFile: string = Bun.main): string {
	const configured = process.env.UNBOUND_PLUGIN_ROOT;

	if (configured) {
		return resolve(configured);
	}

	const found = nearestManifest(dirname(testFile)) ?? nearestManifest(process.cwd());

	if (!found) {
		throw new Error(
			`Failed to find the plugin under test: no manifest.json above ${testFile} or ${process.cwd()}.`,
		);
	}

	return found;
}

/**
 * @description Reads the fields of a plugin's manifest.json that the fake `addon` serves.
 * @param root The plugin's directory.
 * @returns The manifest's string fields and authors; throws when it is not a JSON object.
 */
export function readManifest(root: string): Partial<AddonManifest> {
	const path = join(root, 'manifest.json');
	const value = readJson(path);

	if (!isRecord(value)) {
		throw new Error(`Failed to read ${path}: it is not a JSON object.`);
	}

	const manifest: Partial<AddonManifest> = {};

	for (const key of ['id', 'name', 'description', 'version', 'main'] as const) {
		const field = value[key];

		if (typeof field === 'string') {
			manifest[key] = field;
		}
	}

	if (Array.isArray(value.authors)) {
		manifest.authors = value.authors.filter(
			(author): author is AddonAuthor =>
				isRecord(author) &&
				typeof author.name === 'string' &&
				typeof author.id === 'string' &&
				author.id !== '' &&
				Number.isInteger(Number(author.id)),
		);
	}

	return manifest;
}

/**
 * @description Reads every `i18n/<code>.json` of a plugin, each a JSON object of message keys to strings.
 * @param root The plugin's directory.
 * @returns Each table by locale code; empty when the plugin has no `i18n/`. Throws naming an invalid file.
 */
export function readLocaleTables(root: string): Map<string, LocaleTable> {
	const directory = join(root, LOCALES_DIRECTORY);
	const tables = new Map<string, LocaleTable>();

	if (!existsSync(directory)) {
		return tables;
	}

	for (const file of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
		const path = join(directory, file);
		const value = readJson(path);

		if (!isRecord(value)) {
			throw new Error(`Failed to read ${path}: it is not a JSON object of strings.`);
		}

		const table: LocaleTable = {};

		for (const [key, message] of Object.entries(value)) {
			if (typeof message !== 'string') {
				throw new Error(`Failed to read ${path}: ${key} is not a string.`);
			}

			table[key] = message;
		}

		tables.set(basename(file, '.json'), table);
	}

	return tables;
}

/**
 * @description Finds a plugin's entry as the build does: `src/index` with a TypeScript or JavaScript extension.
 * @param root The plugin's directory.
 * @returns The entry's path, or `undefined` when there is none.
 */
export function findEntry(root: string): string | undefined {
	return ENTRY_EXTENSIONS.map((extension) => join(root, 'src', `index${extension}`)).find(
		(path) => existsSync(path),
	);
}

/**
 * @description Names the asset an image file is, as the build does: its path without extension or `@2x`/`@3x`,
 * relative to `assets/` inside it and to the plugin root outside it.
 * @param root The plugin's directory.
 * @param path The image's absolute path.
 * @returns The asset name, such as `icons/star`.
 */
export function assetNameOf(root: string, path: string): string {
	const assets = join(root, ASSETS_DIRECTORY);
	const base = path.startsWith(assets + sep) ? assets : root;
	const name = relative(base, path).slice(0, -extname(path).length).split(sep).join('/');

	const suffix = SCALE_SUFFIXES.find((each) => name.endsWith(each));

	return suffix ? name.slice(0, -suffix.length) : name;
}
