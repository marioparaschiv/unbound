import { NATIVE_PLUGIN_PLATFORM_CAPABILITIES } from '@unbound-app/types/native';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { expect, test } from 'bun:test';

import {
	PLUGIN_DESCRIPTION_MAX_LENGTH,
	PLUGIN_FOLDER_MAX_LENGTH,
	PLUGIN_NAME_MAX_LENGTH,
	validatePluginDirectory,
	validatePluginFolder,
	validatePluginDocs,
	validateTextInputProps,
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

const validChangelog =
	'# Changelog\n\n## [1.0.0] - 2026-01-01\n\n### Added\n\n- Initial release.\n';

type PluginDocs = {
	addon?: string;
	changelog?: string;
};

function createPlugin(docs: PluginDocs): string {
	const directory = join(mkdtempSync(join(tmpdir(), 'plugin-docs-')), 'example-plugin');

	mkdirSync(directory);

	if (docs.addon !== undefined) writeFileSync(join(directory, 'ADDON.md'), docs.addon);
	if (docs.changelog !== undefined)
		writeFileSync(join(directory, 'CHANGELOG.md'), docs.changelog);

	return directory;
}

test('accepts a plugin with an ADDON.md and a changelog entry for its version', () => {
	const directory = createPlugin({ addon: '# Example\n', changelog: validChangelog });

	expect(validatePluginDocs(directory, '1.0.0')).toEqual([]);
});

test('reports a missing ADDON.md', () => {
	const directory = createPlugin({ changelog: validChangelog });

	expect(validatePluginDocs(directory, '1.0.0')).toEqual(['ADDON.md is missing']);
});

test('reports a whitespace-only ADDON.md', () => {
	const directory = createPlugin({ addon: ' \n\t\n', changelog: validChangelog });

	expect(validatePluginDocs(directory, '1.0.0')).toEqual(['ADDON.md is empty']);
});

test('reports a missing CHANGELOG.md', () => {
	const directory = createPlugin({ addon: '# Example\n' });

	expect(validatePluginDocs(directory, '1.0.0')).toEqual(['CHANGELOG.md is missing']);
});

test('reports changelog parse issues with their line', () => {
	const directory = createPlugin({
		addon: '# Example\n',
		changelog: '# Changelog\n\n## [1.0.0] - yesterday\n\n### Added\n\n- Initial release.\n',
	});
	const errors = validatePluginDocs(directory, '1.0.0');

	expect(errors).toHaveLength(1);
	expect(errors[0]).toStartWith('CHANGELOG.md:3: ');
});

test('reports a changelog without an entry for the manifest version', () => {
	const directory = createPlugin({ addon: '# Example\n', changelog: validChangelog });

	expect(validatePluginDocs(directory, '1.0.1')).toEqual(['CHANGELOG.md has no entry for 1.0.1']);
});

test('leaves a missing manifest version to the manifest check', () => {
	const directory = createPlugin({ addon: '# Example\n', changelog: validChangelog });

	expect(validatePluginDocs(directory, undefined)).toEqual([]);
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

test('flags TextInput props Discord ignores', () => {
	const source = [
		'<Discord.TextInput',
		'\ttitle="Radius"',
		'\thelpText="From 0 to 32."',
		'\tonChange={(value) => set({ radius: value > 1 ? value : 1 })}',
		'/>',
	].join('\n');

	expect(validateTextInputProps(source)).toEqual([
		'line 1: Discord.TextInput ignores title, use label instead',
		'line 1: Discord.TextInput ignores helpText, use description instead',
	]);
});

test('accepts TextInput label and description, and other components with a title', () => {
	const source = [
		'<Discord.TextInput label="Radius" description="From 0 to 32." value={String(radius)} />',
		'<Discord.TableRow title="Radius" />',
	].join('\n');

	expect(validateTextInputProps(source)).toEqual([]);
});
