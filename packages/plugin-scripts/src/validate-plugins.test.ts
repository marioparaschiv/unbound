import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { expect, test } from 'bun:test';

import {
	validatePluginDirectory,
	validatePluginFolder,
	validatePluginDocs,
	validateSettingsPanel,
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

test('reports naming, required field and capability problems for a plugin folder', () => {
	const errors = validatePluginFolder('Example_Plugin', {
		...validManifest,
		authors: [],
		capabilities: ['native.objc.unknown'],
	});

	expect(errors).toEqual([
		'folder must use lowercase kebab-case',
		'id must end with .Example_Plugin',
		'authors must be a non-empty array',
		'capabilities contains an unsupported value: native.objc.unknown',
	]);
});

test('reports only the folder when the manifest is not an object', () => {
	expect(validatePluginFolder('Example_Plugin', [])).toEqual([
		'folder must use lowercase kebab-case',
		'manifest must be an object',
	]);
});

function createEntry(config: string, entry: string): string {
	const directory = createPlugin({});

	mkdirSync(join(directory, 'src'));
	writeFileSync(join(directory, 'rollup.config.mjs'), config);
	writeFileSync(join(directory, 'src', 'index.tsx'), entry);

	return directory;
}

const panelConfig = 'export default unbound(import.meta.url, { settingsPanel: true });';
const plainConfig = 'export default unbound(import.meta.url);';
const panelEntry = 'export default { start, stop, getSettingsPanel: () => <SettingsPanel /> };';
const plainEntry = 'export default { start, stop };';

test('accepts a settingsPanel flag that matches the entry file', () => {
	expect(validateSettingsPanel(createEntry(panelConfig, panelEntry))).toEqual([]);
	expect(validateSettingsPanel(createEntry(plainConfig, plainEntry))).toEqual([]);
});

test('reports a settingsPanel flag that disagrees with the entry file', () => {
	expect(validateSettingsPanel(createEntry(plainConfig, panelEntry))).toEqual([
		'rollup.config.mjs must set settingsPanel: true because src/index exports getSettingsPanel',
	]);
	expect(validateSettingsPanel(createEntry(panelConfig, plainEntry))).toEqual([
		'rollup.config.mjs sets settingsPanel: true but src/index does not export getSettingsPanel',
	]);
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
