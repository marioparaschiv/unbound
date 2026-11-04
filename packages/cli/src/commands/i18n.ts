import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { SOURCE_LOCALE } from '@unbound-app/contracts/addon-locales';
import { resolve } from 'node:path';

import { formatI18nReport, type I18nReport, type UnusedReport } from '~/lib/locale-report';
import { countCoverageErrors, measureCoverage } from '~/lib/locale-coverage';
import { addSourceKey, fixTranslations } from '~/lib/locale-fix';
import { collectPluginKeys } from '~/lib/locale-usages';
import { readLocaleFile } from '~/lib/locale-files';
import type { LocaleTable } from '~/rollup/locales';
import { defaulted, Type } from '~/lib/schema';

const flag = (description: string) => defaulted(Type.Boolean({ description }), false);

const schema = Type.Object({
	text: defaulted(
		Type.Array(Type.String(), { description: 'The English text of the key `--add` adds.' }),
		[],
	),
	plugin: Type.Optional(
		Type.String({ description: 'The plugin directory. Defaults to the current directory.' }),
	),
	fix: flag('Add each missing key to every translation, with its en-US text as a stub.'),
	prune: flag('With --fix, also remove keys en-US does not have. Implies --fix.'),
	unused: flag('List en-US keys no source uses, and used keys en-US lacks.'),
	strict: flag('Fail on missing and untranslated keys too.'),
	add: Type.Optional(
		Type.String({ description: 'Add this key to en-US with the text given after it.' }),
	),
});

function findUnused(pluginRoot: string, source: LocaleTable): UnusedReport {
	const { usages, dynamic, failures } = collectPluginKeys(pluginRoot);
	const used = new Set(usages.map((usage) => usage.key));

	return {
		unused: Object.keys(source).filter((key) => !used.has(key)),
		undefinedKeys: usages.filter((usage) => source[usage.key] === undefined),
		dynamic,
		failures,
	};
}

const i18nCommand: CommandDefinition<typeof schema> = {
	name: 'i18n',
	description:
		"Report how far each translation in a plugin's i18n/ folder covers en-US.json, with every ICU problem. " +
		'--fix stubs missing keys, --unused lists keys no source uses, --add adds a key to en-US.',
	summary: "Check and fix a plugin's translations.",
	surfaces: { cli: 'root', mcp: false },
	schema,
	cli: { positionals: ['text'] },
	async handler({ text, plugin, fix, prune, unused, strict, add }) {
		const pluginRoot = resolve(plugin ?? process.cwd());
		let sourceFile = readLocaleFile(pluginRoot, SOURCE_LOCALE);

		if (!sourceFile.table) {
			return {
				ok: false,
				text: `${pluginRoot} has no readable i18n/${SOURCE_LOCALE}.json: ${sourceFile.error}.`,
			};
		}

		let added: I18nReport['added'];

		if (add !== undefined) {
			const result = addSourceKey(pluginRoot, sourceFile, add, text.join(' '));

			if (result.error !== undefined) {
				return { ok: false, text: result.error };
			}

			added = { key: add, typings: result.typings };
			sourceFile = readLocaleFile(pluginRoot, SOURCE_LOCALE);
		}

		const source = sourceFile.table ?? {};
		const fixed = fix || prune ? fixTranslations(pluginRoot, source, prune) : undefined;
		const coverage = measureCoverage(pluginRoot, sourceFile, source);
		const unusedReport = unused ? findUnused(pluginRoot, source) : undefined;
		const errors =
			countCoverageErrors(coverage, strict) +
			(unusedReport ? unusedReport.undefinedKeys.length + unusedReport.failures.length : 0);
		const report: I18nReport = {
			...coverage,
			plugin: pluginRoot,
			ok: errors === 0,
			errors,
			added,
			fixed,
			unused: unusedReport,
		};

		return { ok: report.ok, text: formatI18nReport(report), data: report };
	},
};

export default i18nCommand;
