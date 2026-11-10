import { SOURCE_LOCALE } from '@unbound-app/contracts/addon-locales';

import { keyLine, readLocaleFile, type LocaleFile } from '~/lib/locale-files';
import { measureCoverage, type IcuProblem } from '~/lib/locale-coverage';
import { diagnostic, type Diagnostic } from '~/lib/check/diagnostic';
import { collectPluginKeys } from '~/lib/locale-usages';
import type { Check } from '~/lib/check/check';

// The build's `locales` check already reports syntax errors, placeholder mismatches and extra keys.
function noOtherDiagnostics(problems: IcuProblem[]): Diagnostic[] {
	return problems.flatMap((problem) =>
		problem.kind === 'no-other'
			? [
					diagnostic({
						file: problem.file,
						line: problem.line,
						column: 1,
						path: problem.key,
						severity: 'error',
						message: `{${problem.argument}} has no "other" branch, so a value no branch names renders nothing`,
						fix: `add an other {…} branch`,
					}),
				]
			: [],
	);
}

function keyDiagnostics(pluginRoot: string, sourceFile: LocaleFile): Diagnostic[] {
	const source = sourceFile.table ?? {};
	const { usages, failures } = collectPluginKeys(pluginRoot);
	const used = new Set(usages.map((usage) => usage.key));
	const found: Diagnostic[] = [];

	for (const usage of usages) {
		if (source[usage.key] !== undefined) {
			continue;
		}

		found.push(
			diagnostic({
				file: usage.file,
				line: usage.line,
				column: 1,
				path: usage.key,
				severity: 'error',
				message: `${usage.site} names ${usage.key}, which ${sourceFile.file} does not have`,
				fix: `add it: ubd i18n --add ${usage.key} "<English text>"`,
			}),
		);
	}

	for (const key of Object.keys(source)) {
		if (used.has(key)) {
			continue;
		}

		found.push(
			diagnostic({
				file: sourceFile.file,
				line: keyLine(sourceFile.text, key),
				column: 1,
				path: key,
				severity: 'warning',
				message: 'no file in src/ or settings.ts uses it',
				fix: 'remove it, or use it; a key read as messages[name] is not seen',
			}),
		);
	}

	for (const failure of failures) {
		found.push(
			diagnostic({
				file: failure.file,
				severity: 'error',
				message: `Failed to read its message keys: ${failure.error}`,
			}),
		);
	}

	return found;
}

// Without en-US, every key a toast, dialog or command names shows as the key itself.
function keylessDiagnostics(pluginRoot: string, sourceFile: LocaleFile): Diagnostic[] {
	return collectPluginKeys(pluginRoot).usages.map((usage) =>
		diagnostic({
			file: usage.file,
			line: usage.line,
			column: 1,
			path: usage.key,
			severity: 'error',
			message: `${usage.site} names ${usage.key}, but the plugin has no ${sourceFile.file}`,
			fix: `add ${sourceFile.file} with the key: ubd i18n --add ${usage.key} "<English text>"`,
		}),
	);
}

export const i18nCheck: Check = {
	id: 'i18n',
	/**
	 * @description Checks a plugin's translations as `ubd i18n --unused` does: missing translations, a plural or
	 * select without `other`, keys the source names that en-US lacks, and en-US keys nothing uses.
	 * @param context The addon to check.
	 * @returns The problems; without `i18n/en-US.json`, one per key the source names.
	 */
	run({ addon }) {
		if (addon.static || addon.kind !== 'plugin') {
			return [];
		}

		const sourceFile = readLocaleFile(addon.dir, SOURCE_LOCALE);

		if (!sourceFile.table) {
			return keylessDiagnostics(addon.dir, sourceFile);
		}

		const coverage = measureCoverage(addon.dir, sourceFile, sourceFile.table);
		const found = [
			...noOtherDiagnostics(coverage.source.problems),
			...keyDiagnostics(addon.dir, sourceFile),
		];

		for (const locale of coverage.locales) {
			found.push(...noOtherDiagnostics(locale.problems));

			if (locale.missing.length) {
				found.push(
					diagnostic({
						file: locale.file,
						severity: 'warning',
						message: `lacks ${locale.missing.length} of ${locale.total} keys (${locale.missing.join(', ')}), which show in English`,
						fix: 'translate them; ubd i18n --fix stubs them with the English text',
					}),
				);
			}
		}

		return found;
	},
};

export default i18nCheck;
