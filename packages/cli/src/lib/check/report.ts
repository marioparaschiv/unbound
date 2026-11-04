import { join, relative } from 'node:path';
import pc from 'picocolors';

import type { Diagnostic, Severity } from '~/rollup/diagnostic';
import type { AddonDiagnostics } from '~/lib/check/run';
import type { DiscoveredAddon } from '~/lib/discovery';
import { formatDiagnostic } from '~/rollup/diagnostic';

export type Summary = {
	errors: number;
	warnings: number;
	files: number;
};

const LABELS: Record<Severity, string> = {
	error: pc.red('error  '),
	warning: pc.yellow('warning'),
};

const FIXED_LABEL = pc.green('fixed  ');

/**
 * @description Names a diagnostic's file as the reader at `cwd` sees it; an addon-wide one names the addon's directory.
 * @param addon The addon the diagnostic is in.
 * @param diagnostic The diagnostic.
 * @param cwd The directory paths are shown relative to.
 * @returns The path.
 */
export function displayFile(addon: DiscoveredAddon, diagnostic: Diagnostic, cwd: string): string {
	return relative(cwd, join(addon.dir, diagnostic.file)) || '.';
}

/**
 * @description Formats one diagnostic as a report line: its severity, then the shared diagnostic format.
 * @param addon The addon the diagnostic is in.
 * @param diagnostic The diagnostic.
 * @param cwd The directory paths are shown relative to.
 * @param fixed Label it as gone since the last `--watch` run instead of by severity.
 * @returns The line.
 */
export function formatReportLine(
	addon: DiscoveredAddon,
	diagnostic: Diagnostic,
	cwd: string,
	fixed = false,
): string {
	const label = fixed ? FIXED_LABEL : LABELS[diagnostic.severity];

	return `${label}  ${formatDiagnostic(diagnostic, displayFile(addon, diagnostic, cwd))}`;
}

/**
 * @description Formats diagnostics grouped by file, errors before warnings, with a blank line between files.
 * @param results Each addon's sorted diagnostics.
 * @param cwd The directory paths are shown relative to.
 * @returns The report, empty when nothing was found.
 */
export function formatReport(results: readonly AddonDiagnostics[], cwd: string): string {
	const groups: string[][] = [];
	let previous: string | undefined;

	for (const { addon, diagnostics } of results) {
		for (const diagnostic of diagnostics) {
			const file = displayFile(addon, diagnostic, cwd);

			if (file !== previous) {
				groups.push([]);
				previous = file;
			}

			groups.at(-1)?.push(formatReportLine(addon, diagnostic, cwd));
		}
	}

	return groups.map((lines) => lines.join('\n')).join('\n\n');
}

/**
 * @description Counts the errors, warnings and files with diagnostics.
 * @param results Each addon's diagnostics.
 * @returns The counts.
 */
export function summarize(results: readonly AddonDiagnostics[]): Summary {
	const all = results.flatMap(({ addon, diagnostics }) =>
		diagnostics.map((diagnostic) => ({ diagnostic, file: join(addon.dir, diagnostic.file) })),
	);
	const errors = all.filter(({ diagnostic }) => diagnostic.severity === 'error').length;

	return {
		errors,
		warnings: all.length - errors,
		files: new Set(all.map(({ file }) => file)).size,
	};
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * @description Formats the summary line, such as `3 errors, 1 warning in 2 files`.
 * @param summary The counts.
 * @param addons How many addons were checked, named when nothing was found.
 * @returns The line.
 */
export function formatSummary({ errors, warnings, files }: Summary, addons: number): string {
	if (!errors && !warnings) {
		return `No problems in ${plural(addons, 'addon')}.`;
	}

	return `${plural(errors, 'error')}, ${plural(warnings, 'warning')} in ${plural(files, 'file')}`;
}

export default { displayFile, formatReportLine, formatReport, summarize, formatSummary };
