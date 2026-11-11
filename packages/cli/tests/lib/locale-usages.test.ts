import { afterEach, describe, expect, test } from 'bun:test';

import { collectModuleKeys, collectPluginKeys } from '~/lib/locale-usages';

import { createPlugin } from '../helpers/i18n-plugin';
import { runUbd, type TempDir } from '../helpers/ubd';

const ENTRY = `import { format, messages as strings } from '@unbound-app/i18n';
import * as i18n from '@unbound-app/i18n';
import { commands, dialogs, toasts } from '@unbound-app/api';
import { option } from '@unbound-app/api/commands';

export function start(key: string) {
	toasts.success('TOAST_KEY', { title: 'NOT_A_KEY' });
	void dialogs.confirm('DIALOG_TITLE', { confirm: 'DIALOG_CONFIRM', destructive: true });
	commands.register({
		ping: {
			description: 'COMMAND_DESCRIPTION',
			options: { size: option.choice({ small: 'CHOICE_LABEL' }) },
			execute() {
				return { description: 'NOT_CONFIGURATION' };
			},
		},
	});
	other.format('NOT_A_KEY');

	return [
		strings.MEMBER_KEY,
		strings['COMPUTED_KEY'],
		i18n.messages.NAMESPACE_KEY,
		format('FORMAT_KEY', { n: 1 }),
		format(key),
		strings[key],
		<Row label={format(cond ? 'BRANCH_A' : 'BRANCH_B')} />,
	];
}
`;

const SETTINGS = `import { defineSettings } from '@unbound-app/settings/schema';

export default defineSettings({
	greet: { type: 'switch', title: 'SETTING_TITLE', subtitle: 'SETTING_SUBTITLE' },
	mode: { type: 'picker', title: 'MODE_TITLE', options: [{ label: 'OPTION_LABEL', value: 'a' }, 'OPTION_BARE'] },
});
`;

const plugins: TempDir[] = [];

afterEach(() => {
	for (const plugin of plugins.splice(0)) plugin.remove();
});

describe('collectModuleKeys', () => {
	test('reads every call-site kind, and skips callbacks and unrelated calls', () => {
		const { usages, dynamic } = collectModuleKeys('src/index.tsx', ENTRY);

		expect(usages.map(({ key, site }) => [key, site])).toEqual([
			['TOAST_KEY', "toasts.success('KEY', vars)"],
			['DIALOG_TITLE', "dialogs.confirm('KEY', { body, confirm, cancel })"],
			['DIALOG_CONFIRM', "dialogs.confirm('KEY', { body, confirm, cancel })"],
			['COMMAND_DESCRIPTION', 'commands.register({ description, label })'],
			['CHOICE_LABEL', "option.choice({ value: 'KEY' })"],
			['MEMBER_KEY', 'messages.KEY'],
			['COMPUTED_KEY', 'messages.KEY'],
			['NAMESPACE_KEY', 'messages.KEY'],
			['FORMAT_KEY', "format('KEY', …)"],
			['BRANCH_A', "format('KEY', …)"],
			['BRANCH_B', "format('KEY', …)"],
		]);
		expect(usages[0]).toMatchObject({ file: 'src/index.tsx', line: 7 });
		expect(dynamic.map(({ line, site }) => [line, site])).toEqual([
			[25, "format('KEY', …)"],
			[26, 'messages.KEY'],
		]);
	});

	test('reads defineSettings titles, subtitles and picker options', () => {
		const { usages } = collectModuleKeys('settings.ts', SETTINGS);

		expect(usages.map((usage) => usage.key)).toEqual([
			'SETTING_TITLE',
			'SETTING_SUBTITLE',
			'MODE_TITLE',
			'OPTION_LABEL',
			'OPTION_BARE',
		]);
	});

	test('reads a setting placeholder and a button confirmation', () => {
		const code = `import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	name: setting.string({ default: '', title: 'NAME_TITLE', placeholder: 'NAME_PLACEHOLDER' }),
	clear: setting.button({ title: 'CLEAR_TITLE', action: 'clear', confirm: 'CLEAR_CONFIRM' }),
});
`;

		expect(collectModuleKeys('settings.ts', code).usages.map((usage) => usage.key)).toEqual([
			'NAME_TITLE',
			'NAME_PLACEHOLDER',
			'CLEAR_TITLE',
			'CLEAR_CONFIRM',
		]);
	});

	test('ignores format and messages that are not from @unbound-app/i18n', () => {
		const code = "const messages = {};\nconst format = (k) => k;\nformat('A');\nmessages.B;\n";

		expect(collectModuleKeys('src/a.ts', code).usages).toEqual([]);
	});
});

describe('ubd i18n unused', () => {
	test('lists unused en-US keys and used keys en-US lacks', async () => {
		const created = createPlugin({
			locales: {
				'en-US': { FORMAT_KEY: 'x', MEMBER_KEY: 'y', SETTING_TITLE: 'z', UNUSED: 'u' },
			},
			files: {
				'src/index.ts':
					"import { format, messages } from '@unbound-app/i18n';\nexport const a = [format('FORMAT_KEY'), messages.MEMBER_KEY, messages.GONE];\n",
				'src/broken.ts': 'export const = ;',
				'src/unbound-i18n.d.ts':
					"declare module '@unbound-app/i18n' { export const messages: { NOT_READ: string } }",
				'settings.ts':
					"import { defineSettings } from '@unbound-app/settings/schema';\nexport default defineSettings({ a: { title: 'SETTING_TITLE' } });\n",
			},
		});

		plugins.push(created);

		const found = collectPluginKeys(created.path);

		expect(found.failures.map((failure) => failure.file)).toEqual(['src/broken.ts']);

		const result = await runUbd(['i18n', 'unused', '--json'], created.path, {});
		const report = JSON.parse(result.stdout);

		expect(result.exitCode).toBe(1);
		expect(report.unused.unused).toEqual(['UNUSED']);
		expect(report.unused.undefinedKeys).toEqual([
			{ key: 'GONE', file: 'src/index.ts', line: 2, site: 'messages.KEY' },
		]);
		expect(report.errors).toBe(2);
	});
});
