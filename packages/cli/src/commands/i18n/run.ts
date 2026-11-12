import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { SOURCE_LOCALE } from '@unbound-app/contracts/addon-locales';
import { resolve } from 'node:path';

import { formatI18nReport, type I18nReport, type UnusedReport } from '~/lib/locale-report';
import { countCoverageErrors, measureCoverage } from '~/lib/locale-coverage';
import { addSourceKey, fixTranslations } from '~/lib/locale-fix';
import { collectPluginKeys } from '~/lib/locale-usages';
import { readLocaleFile } from '~/lib/locale-files';
import type { LocaleTable } from '~/rollup/locales';

/** What one `ubd i18n` command asks of {@link runI18n}, beyond the coverage report all of them print. */
export type I18nOptions = {
	plugin?: string;
	strict?: boolean;
	fix?: boolean;
	prune?: boolean;
	unused?: boolean;
	add?: { key: string; text: string };
};

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

/**
 * @description Applies an `ubd i18n` command's change, then reports how far each translation covers
 * en-US.json with every ICU problem.
 * @param options The plugin, and what to add, fix or list.
 * @returns The formatted report with the report as data, or why the source table is unreadable.
 */
export async function runI18n({
	plugin,
	strict = false,
	fix = false,
	prune = false,
	unused = false,
	add,
}: I18nOptions): Promise<CommandOutput> {
	const pluginRoot = resolve(plugin ?? process.cwd());
	let sourceFile = readLocaleFile(pluginRoot, SOURCE_LOCALE);

	if (!sourceFile.table) {
		return {
			ok: false,
			text: `${pluginRoot} has no readable i18n/${SOURCE_LOCALE}.json: ${sourceFile.error}.`,
		};
	}

	let added: I18nReport['added'];

	if (add) {
		const result = addSourceKey(pluginRoot, sourceFile, add.key, add.text);

		if (result.error !== undefined) {
			return { ok: false, text: result.error };
		}

		added = { key: add.key, typings: result.typings };
		sourceFile = readLocaleFile(pluginRoot, SOURCE_LOCALE);
	}

	const source = sourceFile.table ?? {};
	const fixed = fix ? fixTranslations(pluginRoot, source, prune) : undefined;
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
}

export default runI18n;
