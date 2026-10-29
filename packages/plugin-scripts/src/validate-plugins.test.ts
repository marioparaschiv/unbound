import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import {
	PLUGIN_DESCRIPTION_MAX_LENGTH,
	PLUGIN_FOLDER_MAX_LENGTH,
	PLUGIN_NAME_MAX_LENGTH,
	validatePluginDirectory,
	validatePluginFolder,
} from './validate-plugins';
import { PLUGINS_DIR } from './paths';

const validManifest = {
	id: 'unbound.example-plugin',
	name: 'Example Plugin',
	description: 'A concise example plugin description.',
	authors: [{ name: 'adrian', id: '224617799434108928' }],
	version: '1.0.0',
	main: 'index.js',
};

test('every plugin folder follows the workspace convention', () => {
	expect(validatePluginDirectory(PLUGINS_DIR)).toEqual([]);
});

test('the workspace contains only first-party plugins', () => {
	const plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true }).filter((entry) => {
		return entry.isDirectory() && !['node_modules', 'shared'].includes(entry.name);
	});

	expect(plugins).toHaveLength(34);
	expect(
		plugins.every((plugin) => {
			const manifestPath = join(PLUGINS_DIR, plugin.name, 'manifest.json');
			if (!existsSync(manifestPath)) return false;
			const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
			return manifest.authors.some((author: { name: string }) => author.name === 'adrian');
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
			platforms: ['ios'],
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

test('rejects a flat capability that only one platform can provide', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			capabilities: ['native.objc.classes'],
		}),
	).toContain(
		'capabilities contains native.objc.classes, which android cannot provide; declare it under platformCapabilities.ios',
	);
});

test('accepts a flat capability that every supported platform provides', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			capabilities: ['native.runtime.events'],
		}),
	).toEqual([]);
});

test('accepts a platform-exclusive capability declared under its platform', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			platforms: ['ios'],
			platformCapabilities: { ios: ['native.objc.classes', 'native.fabric.mount'] },
		}),
	).toEqual([]);
});

test('accepts a flat capability restricted to the declared platforms', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			platforms: ['ios'],
			capabilities: ['native.objc.classes'],
		}),
	).toEqual([]);
});

test('rejects platforms that are not supported targets', () => {
	expect(
		validatePluginFolder('example-plugin', { ...validManifest, platforms: ['web'] }),
	).toContain('platforms contains an unsupported value: web');
});

test('rejects an empty platforms list', () => {
	expect(validatePluginFolder('example-plugin', { ...validManifest, platforms: [] })).toContain(
		'platforms must not be empty',
	);
});

test('rejects duplicate platforms', () => {
	expect(
		validatePluginFolder('example-plugin', { ...validManifest, platforms: ['ios', 'ios'] }),
	).toContain('platforms must not repeat ios');
});

test('rejects platformCapabilities for a platform the plugin does not support', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			platforms: ['ios'],
			platformCapabilities: { android: ['native.java.classes'] },
		}),
	).toContain('platformCapabilities declares android, which is not in platforms');
});

test('rejects a platformCapabilities entry the platform cannot provide', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			platformCapabilities: { android: ['native.objc.classes'] },
		}),
	).toContain('platformCapabilities.android cannot provide native.objc.classes');
});

test('rejects platformCapabilities values that are not arrays', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			platformCapabilities: { ios: 'native.objc.classes' },
		}),
	).toContain('platformCapabilities.ios must be an array');
});

test('rejects an unknown platformCapabilities platform', () => {
	expect(
		validatePluginFolder('example-plugin', {
			...validManifest,
			platformCapabilities: { web: ['native.java.classes'] },
		}),
	).toContain('platformCapabilities contains an unsupported platform: web');
});
