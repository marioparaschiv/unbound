import { afterAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { settingsTypings, writeSettingsTypings } from '../src/rollup/settings-typings';
import { buildPlugin, createPlugin, removePlugins } from './helpers/settings-plugin';
import { readPluginSettings } from '../src/rollup/settings-read';
import { formatDiagnostic } from '../src/rollup/diagnostic';

const FIXTURE = join(import.meta.dir, 'fixtures', 'settings-plugin');
const IMPORT = "import { defineSettings, setting } from '@unbound-app/settings/schema';\n";
const MESSAGES = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G' };

afterAll(removePlugins);

async function issues(settings: string, messages: Record<string, string> | null = MESSAGES) {
	const read = await readPluginSettings(createPlugin({ settings: IMPORT + settings, messages }));

	return (read?.issues ?? []).map((issue) => formatDiagnostic(issue));
}

describe('the fixture plugin', () => {
	test('reads with no problems', async () => {
		expect((await readPluginSettings(FIXTURE))?.issues).toEqual([]);
	});

	test('keeps its generated typings current', async () => {
		const settings = await readPluginSettings(FIXTURE);

		if (!settings) {
			throw new Error('The fixture has no settings.ts.');
		}

		expect(
			settingsTypings(settings.schema, settings.messages, Boolean(settings.actionsPath)),
		).toBe(readFileSync(join(FIXTURE, 'src', 'unbound-settings.d.ts'), 'utf8'));
	});

	test('bundles its predicates and actions without TypeBox or the builders', async () => {
		const { code, modules } = await buildPlugin(FIXTURE);

		expect(code).toContain('settings.greetOnStart');
		expect(code).toContain('clearCache');
		expect(code).toMatch(/SettingsPanel:(function )?SettingsPanel\b/);
		expect(
			modules.filter((id) =>
				/[/\\]node_modules[/\\]typebox[/\\]|settings[/\\]schema\.ts$|[/\\]settings\.ts$/.test(
					id,
				),
			),
		).toEqual([]);
	});

	test('imports actions that read settings without a cycle', async () => {
		const { warnings } = await buildPlugin(FIXTURE);

		expect(warnings).not.toContain('CIRCULAR_DEPENDENCY');
	});
});

describe('settings.ts validation', () => {
	test('reports a literal or unknown title with the key to add', async () => {
		const found = await issues(
			"export default defineSettings({ a: setting.boolean({ default: true, title: 'Greet' as 'A' }) });",
		);

		expect(found).toEqual([
			'settings.ts:2:33  a  title "Greet" is not a key of i18n/en-US.json.  Fix: add "Greet" (or "A") to i18n/en-US.json.',
		]);
	});

	test('requires an i18n folder', async () => {
		const found = await issues(
			"export default defineSettings({ a: setting.boolean({ default: true, title: 'A' }) });",
			null,
		);

		expect(found[0]).toContain(
			'settings  labels are message keys, but the plugin has no i18n/en-US.json.  Fix: create i18n/en-US.json',
		);
	});

	test('rejects a setting not built with a builder', async () => {
		const found = await issues(
			"export default defineSettings({ a: { type: 'boolean', default: true } as never });",
		);

		expect(found[0]).toContain(
			'a  is not built with a setting builder.  Fix: use setting.boolean/number',
		);
	});

	test('requires a title unless the setting is hidden', async () => {
		expect(
			await issues(
				'export default defineSettings({ a: setting.boolean({ default: true } as never) });',
			),
		).toEqual([
			'settings.ts:2:33  a  has no title.  Fix: add `title: <message key>`, or `hidden: true`.',
		]);
		expect(
			await issues(
				'export default defineSettings({ a: setting.boolean({ default: true, hidden: true }) });',
			),
		).toEqual([]);
	});

	test('rejects display options on another display', async () => {
		const found = await issues(
			"export default defineSettings({ a: setting.string({ default: '', title: 'A', alpha: true } as never) });",
		);

		expect(found[0]).toContain("a  sets `alpha`, which only displayAs 'color' takes");
	});

	test('rejects a slider without a range', async () => {
		const found = await issues(
			"export default defineSettings({ a: setting.number({ default: 1, title: 'A', displayAs: 'slider' } as never) });",
		);

		expect(found[0]).toContain('a  shows as a slider without both `min` and `max`');
	});

	test('rejects a segmented control of more than four options', async () => {
		const found = await issues(
			"export default defineSettings({ a: setting.choice({ default: 'a', title: 'A', displayAs: 'segmented', options: { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' } }) });",
		);

		expect(found[0]).toContain(
			"a  shows 5 options as segmented, which fits at most 4.  Fix: use displayAs: 'radio' or 'picker'.",
		);
	});

	test('rejects a default its display rejects', async () => {
		const found = await issues(
			"export default defineSettings({ a: setting.string({ default: 'red' as '#', title: 'A', displayAs: 'color' }) });",
		);

		expect(found[0]).toContain(
			'a  has the default "red", which its own display or constraints reject',
		);
	});

	test('names a predicate that reads an outer variable', async () => {
		const found = await issues(
			"const limit = 3;\nexport default defineSettings({\n\ta: setting.boolean({ default: true, title: 'A' }),\n\tb: setting.boolean({ default: true, title: 'B', visibleWhen: (settings) => settings.a && limit > 2 }),\n});",
		);

		expect(found).toEqual([
			'settings.ts:5:91  b.visibleWhen  reads outer variable "limit".  Fix: read only the predicate\'s `settings` parameter; the predicate runs in the plugin bundle without settings.ts.',
		]);
	});

	test('rejects a condition naming a setting that is not a boolean', async () => {
		const found = await issues(
			"export default defineSettings({ a: setting.number({ default: 1, title: 'A' }), b: setting.boolean({ default: true, title: 'B', visibleWhen: 'a' as never }) });",
		);

		expect(found[0]).toContain('b.visibleWhen  names "a", which is not a boolean setting');
	});
});

describe('ubd dev', () => {
	test('rewrites the typings from a changed en-US within a second', async () => {
		const root = createPlugin({
			settings: `${IMPORT}export default defineSettings({ a: setting.boolean({ default: true, title: 'A' }) });`,
			messages: { A: 'Old label' },
		});

		async function rebuild() {
			const settings = await readPluginSettings(root);

			if (!settings) {
				throw new Error('The plugin has no settings.ts.');
			}

			return writeSettingsTypings(root, settingsTypings(settings.schema, settings.messages));
		}

		await rebuild();
		await Bun.write(join(root, 'i18n', 'en-US.json'), JSON.stringify({ A: 'New label' }));

		const started = performance.now();

		expect(await rebuild()).toBe(true);
		expect(performance.now() - started).toBeLessThan(1000);
		expect(readFileSync(join(root, 'src', 'unbound-settings.d.ts'), 'utf8')).toContain(
			'* New label',
		);
	});
});

describe('buttons', () => {
	const button = `${IMPORT}export default defineSettings({ a: setting.button({ title: 'A', action: 'clear' as never }) });`;

	test('need a src/actions.ts', async () => {
		const found = (
			await readPluginSettings(createPlugin({ settings: button, messages: MESSAGES }))
		)?.issues.map((issue) => formatDiagnostic(issue));

		expect(found).toEqual([
			'settings.ts:2:33  a  is a button, but the plugin has no src/actions.ts.  Fix: create src/actions.ts and export function clear() from it.',
		]);
	});

	test.each([
		['export const other = () => {};', 'runs "clear", which src/actions.ts does not export'],
		[
			'export const clear = 1;',
			'runs "clear", which src/actions.ts exports but not as a function',
		],
	])('run a function src/actions.ts exports: %s', async (actions, problem) => {
		const root = createPlugin({ settings: button, messages: MESSAGES });

		await Bun.write(join(root, 'src', 'actions.ts'), actions);

		expect((await readPluginSettings(root))?.issues[0]?.message).toContain(problem);
	});

	test('pass with a function export', async () => {
		const root = createPlugin({ settings: button, messages: MESSAGES });

		await Bun.write(join(root, 'src', 'actions.ts'), 'export function clear() {}');

		expect((await readPluginSettings(root))?.issues).toEqual([]);
	});
});

describe('choice', () => {
	test('shows up to five options as a radio group and more as a picker', async () => {
		const options = (count: number) =>
			Object.fromEntries(
				Object.keys(MESSAGES)
					.slice(0, count)
					.map((key) => [key.toLowerCase(), key]),
			);

		async function read(count: number) {
			const root = createPlugin({
				settings: `${IMPORT}export default defineSettings({ a: setting.choice({ default: 'a', title: 'A', options: ${JSON.stringify(options(count))} }) });`,
				messages: MESSAGES,
			});

			return (await readPluginSettings(root))?.schema.properties.a;
		}

		expect(await read(5)).toMatchObject({ displayAs: 'radio' });
		expect(await read(6)).toMatchObject({ displayAs: 'picker' });
	});
});

describe('the TypeBox guard', () => {
	const settings = `${IMPORT}export default defineSettings({ a: setting.boolean({ default: true, title: 'A' }) });`;

	test.each([
		[
			"import { setting } from '@unbound-app/settings/schema'; export function start() { return setting; }",
			"imports '@unbound-app/settings/schema'",
		],
		[
			"import Type from 'typebox'; export function start() { return Type; }",
			"imports 'typebox'",
		],
		[
			"import schema from '../settings'; export function start() { return schema; }",
			"imports '../settings'",
		],
		["export function start() { return import('typebox'); }", "imports 'typebox'"],
	])('fails the build on a value import: %s', async (index, message) => {
		const root = createPlugin({ settings, messages: MESSAGES, index });

		const error = await buildPlugin(root).then(
			() => undefined,
			(failure: Error) => failure.message,
		);

		expect(error).toContain(message);
		expect(error).toContain("Fix: read settings from '@unbound-app/settings'");
	});

	test('allows a type-only import', async () => {
		const root = createPlugin({
			settings,
			messages: MESSAGES,
			index: "import type { setting } from '@unbound-app/settings/schema';\nexport type Builders = typeof setting;\nexport function start() {}",
		});

		expect((await buildPlugin(root)).modules.some((id) => id.includes('typebox'))).toBe(false);
	});
});
