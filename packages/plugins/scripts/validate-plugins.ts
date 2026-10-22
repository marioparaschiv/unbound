import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLUGIN_FOLDER_MAX_LENGTH = 48;
export const PLUGIN_NAME_MAX_LENGTH = 64;
export const PLUGIN_DESCRIPTION_MAX_LENGTH = 160;
const supportedCapabilities: readonly string[] = NATIVE_PLUGIN_CAPABILITIES;

const FOLDER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[a-z][a-z0-9-]*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DISPLAY_NAME_PATTERN =
	/^(?:[A-Z][a-z0-9]*|[A-Z]{2,}[a-z]?)(?: (?:[A-Z][a-z0-9]*|[A-Z]{2,}[a-z]?))*$/;
const BRAND_NAME_PATTERN = /^[A-Z][a-z0-9]+[A-Z]{2,}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

type PluginManifest = {
	id?: unknown;
	name?: unknown;
	description?: unknown;
	authors?: unknown;
	version?: unknown;
	main?: unknown;
	capabilities?: unknown;
};

function validateText(value: unknown, label: string, maxLength: number, errors: string[]): void {
	if (typeof value !== 'string' || !value.trim()) {
		errors.push(`${label} must be a non-empty string`);
		return;
	}

	if (value.length > maxLength) errors.push(`${label} must be at most ${maxLength} characters`);
	if (value.trim() !== value)
		errors.push(`${label} must not have leading or trailing whitespace`);
	if (CONTROL_CHARACTERS.test(value)) errors.push(`${label} must not contain control characters`);
}

export function validatePluginFolder(folder: string, manifest: unknown): string[] {
	const errors: string[] = [];

	if (folder.length > PLUGIN_FOLDER_MAX_LENGTH) {
		errors.push(`folder must be at most ${PLUGIN_FOLDER_MAX_LENGTH} characters`);
	}
	if (!FOLDER_PATTERN.test(folder)) errors.push('folder must use lowercase kebab-case');

	if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
		return [...errors, 'manifest must be an object'];
	}

	const data = manifest as PluginManifest;
	validateText(data.name, 'name', PLUGIN_NAME_MAX_LENGTH, errors);
	if (
		typeof data.name === 'string' &&
		data.name.trim() &&
		!DISPLAY_NAME_PATTERN.test(data.name) &&
		!BRAND_NAME_PATTERN.test(data.name)
	) {
		errors.push('name must use title-case words separated by spaces');
	}
	validateText(data.description, 'description', PLUGIN_DESCRIPTION_MAX_LENGTH, errors);

	if (typeof data.id !== 'string' || !ID_PATTERN.test(data.id)) {
		errors.push('id must use a lowercase namespace and kebab-case suffix');
	} else if (!data.id.endsWith(`.${folder}`)) {
		errors.push(`id must end with .${folder}`);
	}

	if (!Array.isArray(data.authors) || data.authors.length === 0)
		errors.push('authors must be a non-empty array');
	if (typeof data.version !== 'string' || !data.version.trim())
		errors.push('version must be a non-empty string');
	if (typeof data.main !== 'string' || !data.main.trim())
		errors.push('main must be a non-empty string');
	if (data.capabilities !== undefined) {
		if (!Array.isArray(data.capabilities)) {
			errors.push('capabilities must be an array');
		} else {
			for (const capability of data.capabilities) {
				if (typeof capability !== 'string' || !supportedCapabilities.includes(capability)) {
					errors.push(
						`capabilities contains an unsupported value: ${String(capability)}`,
					);
				}
			}
		}
	}

	return errors;
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

		if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) {
			const data = manifest as PluginManifest;
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
	const errors = validatePluginDirectory(join(import.meta.dir, '..'));
	if (errors.length === 0) {
		console.log('Plugin naming and manifest validation passed.');
		return;
	}

	console.error(errors.map((error) => `- ${error}`).join('\n'));
	process.exitCode = 1;
}

if (import.meta.main) main();
