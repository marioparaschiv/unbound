import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from 'bun:test';

import {
	PLUGIN_DESCRIPTION_MAX_LENGTH,
	PLUGIN_FOLDER_MAX_LENGTH,
	PLUGIN_NAME_MAX_LENGTH,
	validatePluginDirectory,
	validatePluginFolder,
} from '@scripts/validate-plugins';

const validManifest = {
	id: 'unbound.example-plugin',
	name: 'Example Plugin',
	description: 'A concise example plugin description.',
	authors: [{ name: 'Unbound Team', id: '0' }],
	version: '1.0.0',
	main: 'index.js',
};

test('every plugin folder follows the workspace convention', () => {
	const pluginsDirectory = resolve(import.meta.dir, '..');
	expect(validatePluginDirectory(pluginsDirectory)).toEqual([]);
	expect(readdirSync(pluginsDirectory)).toContain('hello-there');
});

test('the workspace contains only Unbound Team plugins', () => {
	const pluginsDirectory = resolve(import.meta.dir, '..');
	const plugins = readdirSync(pluginsDirectory, { withFileTypes: true }).filter((entry) => {
		return entry.isDirectory() && !['node_modules', 'shared', 'scripts'].includes(entry.name);
	});

	expect(plugins).toHaveLength(33);
	expect(
		plugins.every((plugin) => {
			const manifestPath = resolve(pluginsDirectory, plugin.name, 'manifest.json');
			if (!existsSync(manifestPath)) return plugin.name === 'hello-there';
			const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
			return manifest.authors.some(
				(author: { name: string }) => author.name === 'Unbound Team',
			);
		}),
	).toBe(true);
});

test('accepts a valid plugin folder and manifest', () => {
	expect(validatePluginFolder('example-plugin', validManifest)).toEqual([]);
});

test('accepts declared native capabilities from the client SDK', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			capabilities: ['native.objc.snapshot', 'native.fabric.async'],
		}),
	).toEqual([]);
});

test('rejects native capabilities that are not declared in the client SDK', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			capabilities: ['native.objc.unknown'],
		}),
	).toContain('capabilities contains an unsupported value: native.objc.unknown');
});

test('rejects folders that are not lowercase kebab-case', () => {
	expect(validatePluginFolder('Example_Plugin', validManifest)).toContain(
		'folder must use lowercase kebab-case',
	);
});

test('requires ids to match their plugin folder suffix', () => {
	expect(validatePluginFolder('other-plugin', validManifest)).toContain(
		'id must end with .other-plugin',
	);
});

test('enforces display name and description limits', () => {
	const manifest = {
		...validManifest,
		name: 'x'.repeat(PLUGIN_NAME_MAX_LENGTH + 1),
		description: 'x'.repeat(PLUGIN_DESCRIPTION_MAX_LENGTH + 1),
	};
	const errors = validatePluginFolder('example-plugin', manifest);

	expect(errors).toContain(`name must be at most ${PLUGIN_NAME_MAX_LENGTH} characters`);
	expect(errors).toContain(
		`description must be at most ${PLUGIN_DESCRIPTION_MAX_LENGTH} characters`,
	);
});

test('requires display names to separate words', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		name: 'TextReplace',
	});

	expect(errors).toContain('name must use title-case words separated by spaces');
});

test('allows established brand names with uppercase acronyms', () => {
	expect(validatePluginFolder('example-plugin', { ...validManifest, name: 'PronounDB' })).toEqual(
		[],
	);
	expect(validatePluginFolder('example-plugin', { ...validManifest, name: 'ReviewDB' })).toEqual(
		[],
	);
});

test('enforces the plugin folder length limit', () => {
	const folder = `a${'b'.repeat(PLUGIN_FOLDER_MAX_LENGTH)}`;
	expect(validatePluginFolder(folder, validManifest)).toContain(
		`folder must be at most ${PLUGIN_FOLDER_MAX_LENGTH} characters`,
	);
});
