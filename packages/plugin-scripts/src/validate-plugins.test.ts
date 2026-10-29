import { NATIVE_PLUGIN_PLATFORM_CAPABILITIES } from '@unbound-app/types/native';
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

const androidCapabilities: readonly string[] = NATIVE_PLUGIN_PLATFORM_CAPABILITIES.android;
const [iosOnlyCapability] = NATIVE_PLUGIN_PLATFORM_CAPABILITIES.ios.filter(
	(capability) => !androidCapabilities.includes(capability),
);

test('every plugin folder follows the workspace convention', () => {
	expect(validatePluginDirectory(PLUGINS_DIR)).toEqual([]);
});

test('the workspace contains only first-party plugins', () => {
	const plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true }).filter((entry) => {
		return entry.isDirectory() && !['node_modules', 'shared'].includes(entry.name);
	});

	expect(plugins.length).toBeGreaterThan(0);
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
			platforms: Object.keys(NATIVE_PLUGIN_PLATFORM_CAPABILITIES),
			platformCapabilities: NATIVE_PLUGIN_PLATFORM_CAPABILITIES,
		}),
	).toEqual([]);
});

test('rejects native capabilities that are not declared in the client SDK', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		capabilities: ['native.objc.unknown'],
	});

	expect(errors.join('\n')).toContain('native.objc.unknown');
});

test('rejects folders that are not lowercase kebab-case', () => {
	const errors = validatePluginFolder('Example_Plugin', validManifest);

	expect(errors.join('\n')).toMatch(/folder/);
});

test('requires ids to match their plugin folder suffix', () => {
	const errors = validatePluginFolder('other-plugin', validManifest);

	expect(errors.join('\n')).toContain('other-plugin');
});

test('enforces display name and description limits', () => {
	const manifest = {
		...validManifest,
		name: 'x'.repeat(PLUGIN_NAME_MAX_LENGTH + 1),
		description: 'x'.repeat(PLUGIN_DESCRIPTION_MAX_LENGTH + 1),
	};
	const errors = validatePluginFolder('example-plugin', manifest);

	expect(errors.join('\n')).toMatch(/name/);
	expect(errors.join('\n')).toMatch(/description/);
});

test('requires display names to separate words', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		name: 'TextReplace',
	});

	expect(errors.join('\n')).toMatch(/name/);
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
	const errors = validatePluginFolder(folder, validManifest);

	expect(errors.join('\n')).toMatch(/folder/);
});

test('rejects a flat capability that only one platform can provide', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		capabilities: [iosOnlyCapability],
	});

	expect(errors.find((error) => error.includes(iosOnlyCapability))).toMatch(/android/);
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
	const errors = validatePluginFolder('example-plugin', { ...validManifest, platforms: ['web'] });

	expect(errors.join('\n')).toContain('web');
});

test('rejects an empty platforms list', () => {
	const errors = validatePluginFolder('example-plugin', { ...validManifest, platforms: [] });

	expect(errors.join('\n')).toMatch(/platforms.*empty/);
});

test('rejects duplicate platforms', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		platforms: ['ios', 'ios'],
	});

	expect(errors.join('\n')).toMatch(/platforms.*ios/);
});

test('rejects platformCapabilities for a platform the plugin does not support', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		platforms: ['ios'],
		platformCapabilities: { android: ['native.java.classes'] },
	});

	expect(errors.join('\n')).toMatch(/platformCapabilities.*android/);
});

test('rejects a platformCapabilities entry the platform cannot provide', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		platformCapabilities: { android: [iosOnlyCapability] },
	});

	expect(errors.find((error) => error.includes(iosOnlyCapability))).toMatch(
		/platformCapabilities\.android/,
	);
});

test('rejects platformCapabilities values that are not arrays', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		platformCapabilities: { ios: 'native.objc.classes' },
	});

	expect(errors.join('\n')).toMatch(/platformCapabilities\.ios/);
});

test('rejects an unknown platformCapabilities platform', () => {
	const errors = validatePluginFolder('example-plugin', {
		...validManifest,
		platformCapabilities: { web: ['native.java.classes'] },
	});

	expect(errors.join('\n')).toContain('web');
});
