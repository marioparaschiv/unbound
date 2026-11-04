import { basename } from 'node:path';
import pc from 'picocolors';

import type { CoverageReport, IcuProblem, LocaleCoverage } from '~/lib/locale-coverage';
import type { DynamicUsage, KeyUsages, KeyUsage } from '~/lib/locale-usages';
import type { FixedLocale } from '~/lib/locale-fix';

/** What `--unused` found: en-US keys no source names, and keys the source names that en-US lacks. */
export type UnusedReport = {
	unused: string[];
	undefinedKeys: KeyUsage[];
	dynamic: DynamicUsage[];
	failures: KeyUsages['failures'];
};

/** Everything one `ubd i18n` run did and found; `--json` prints it as is. */
export type I18nReport = CoverageReport & {
	plugin: string;
	ok: boolean;
	errors: number;
	added: { key: string; typings: boolean } | undefined;
	fixed: FixedLocale[] | undefined;
	unused: UnusedReport | undefined;
};

const LISTED = 8;

function list(keys: string[]): string {
	const shown = keys.slice(0, LISTED).join(', ');

	return keys.length > LISTED ? `${shown} ${pc.dim(`+${keys.length - LISTED} more`)}` : shown;
}

function braces(names: string[]): string {
	return names.length ? names.map((name) => `{${name}}`).join(', ') : 'none';
}

function describeProblem(problem: IcuProblem): string {
	const where = `${problem.file}:${problem.line} ${pc.bold(problem.key)}`;

	switch (problem.kind) {
		case 'syntax':
			return `${where}: ${problem.reason}`;
		case 'no-other':
			return `${where}: {${problem.argument}} has no "other" branch`;
		case 'placeholders':
			return `${where}: has ${braces(problem.found)}, en-US has ${braces(problem.expected)}`;
	}
}

function row(cells: string[], widths: number[]): string {
	return cells
		.map((cell, index) =>
			index === 0 ? cell.padEnd(widths[index]!) : cell.padStart(widths[index]!),
		)
		.join('  ');
}

function table(locales: LocaleCoverage[]): string[] {
	const header = ['locale', 'translated', '%', 'missing', 'extra', 'icu'];
	const rows = locales.map((locale) =>
		locale.error
			? [locale.code, '-', '-', '-', '-', '-']
			: [
					locale.code,
					`${locale.translated}/${locale.total}`,
					`${locale.percent}%`,
					String(locale.missing.length + locale.untranslated.length),
					String(locale.extra.length),
					String(locale.problems.length),
				],
	);
	const widths = header.map((cell, index) =>
		Math.max(cell.length, ...rows.map((cells) => cells[index]!.length)),
	);

	return [pc.dim(row(header, widths)), ...rows.map((cells) => row(cells, widths))];
}

function fixLines(fixed: FixedLocale[]): string[] {
	return fixed.flatMap((locale) => {
		if (locale.error) {
			return [`${pc.red('✗')} ${locale.error}`];
		}

		const parts = [
			locale.added.length && `added ${locale.added.length}`,
			locale.refreshed.length && `refreshed ${locale.refreshed.length}`,
			locale.pruned.length && `pruned ${list(locale.pruned)}`,
		].filter(Boolean);

		return locale.changed
			? [`${pc.green('✓')} ${locale.file}: ${parts.join(', ') || 'reordered'}`]
			: [];
	});
}

function localeLines(locale: LocaleCoverage): string[] {
	if (locale.error) {
		return [`${pc.red('✗')} ${locale.error}`];
	}

	return [
		...locale.problems.map((problem) => `${pc.red('✗')} ${describeProblem(problem)}`),
		...(locale.extra.length
			? [
					`${pc.red('✗')} ${locale.file}: not in en-US, left out of the build: ${list(locale.extra)}`,
				]
			: []),
		...(locale.missing.length
			? [`${pc.yellow('·')} ${locale.code} missing: ${list(locale.missing)}`]
			: []),
		...(locale.untranslated.length
			? [`${pc.yellow('·')} ${locale.code} still English: ${list(locale.untranslated)}`]
			: []),
	];
}

function unusedLines(unused: UnusedReport): string[] {
	return [
		...unused.failures.map(
			({ file, error }) => `${pc.red('✗')} ${file}: failed to parse: ${error}`,
		),
		...unused.undefinedKeys.map(
			(usage) =>
				`${pc.red('✗')} ${usage.file}:${usage.line} ${pc.bold(usage.key)} is not in en-US.json (${usage.site})`,
		),
		unused.unused.length
			? `${pc.yellow('·')} unused: ${list(unused.unused)}`
			: `${pc.green('✓')} every en-US key is used`,
		...(unused.dynamic.length
			? [
					pc.dim(
						`${unused.dynamic.length} computed key read(s), such as ${unused.dynamic[0]!.file}:${unused.dynamic[0]!.line}, may use keys listed as unused`,
					),
				]
			: []),
	];
}

/**
 * @description Renders a `ubd i18n` report compactly: one table row per locale, then one line per problem.
 * @param report The report.
 * @returns The text, coloured when the terminal supports it.
 */
export function formatI18nReport(report: I18nReport): string {
	const lines = [
		`${pc.bold(basename(report.plugin))}  ${report.source.file}  ${report.source.total} keys`,
	];

	if (report.added) {
		lines.push(
			`${pc.green('✓')} added ${report.added.key}${report.added.typings ? ', typings updated' : ''}`,
		);
	}

	lines.push(...fixLines(report.fixed ?? []));
	lines.push(
		...report.source.problems.map((problem) => `${pc.red('✗')} ${describeProblem(problem)}`),
	);
	lines.push(
		...(report.locales.length ? table(report.locales) : [pc.dim('No translations yet.')]),
	);
	lines.push(...report.locales.flatMap((locale) => localeLines(locale)));

	if (report.unused) {
		lines.push(...unusedLines(report.unused));
	}

	lines.push(
		report.ok
			? pc.green('No errors.')
			: pc.red(`${report.errors} error${report.errors === 1 ? '' : 's'}.`),
	);

	return lines.join('\n');
}
