import pc from 'picocolors';

import type { BuildReport, ReportGroup, ReportWarning } from '~/rollup/build-report-schema';
import { formatBytes } from '~/rollup/byte-size';

export type ReportFormatOptions = {
	/** Also list the largest source modules. */
	verbose?: boolean;
	/** Mark budget warnings as errors. */
	strict?: boolean;
};

type Row = { label: string; size?: string; extra?: string };

const SECTION_WIDTH = 12;
const LABEL_WIDTH = 18;
const SIZE_WIDTH = 9;
const LISTED_MODULES = 3;

function plural(noun: string, count: number) {
	return count === 1 ? noun : `${noun}s`;
}

function groupLabel(group: ReportGroup) {
	if (group.unit === void 0) {
		return group.label;
	}

	const unit = group.unit ? ` ${plural(group.unit, group.items)}` : '';

	return `${group.label} (${group.items}${unit})`;
}

function groupRow(group: ReportGroup): Row {
	const tallies = Object.entries(group.tallies).map(([kind, count]) => `${count} ${kind}`);
	const locations = group.locations.length ? pc.dim(`  (${group.locations.join(', ')})`) : '';

	if (tallies.length && !group.bytes) {
		return { label: `${groupLabel(group)} ${tallies.join(' · ')}${locations}` };
	}

	return {
		label: groupLabel(group),
		size: formatBytes(group.bytes),
		extra: `${tallies.join(' · ')}${locations}`.trim(),
	};
}

function renderSection(section: string, rows: Row[], labelWidth: number): string[] {
	return rows.map(({ label, size, extra }, index) => {
		const name = (index === 0 ? section : '').padEnd(SECTION_WIDTH);
		const cells = size
			? `${label.padEnd(labelWidth)}${size.padStart(SIZE_WIDTH)}${extra ? `   ${extra}` : ''}`
			: label;

		return `  ${pc.dim(name)}${cells}`.trimEnd();
	});
}

function bundleRow({ bundle }: BuildReport): Row {
	const largest = Math.max(0, ...bundle.bytecode.map(({ bytes }) => bytes));
	const bytecode = largest ? `   bytecode ${formatBytes(largest)}` : '';

	return {
		label: bundle.file,
		size: formatBytes(bundle.bytes),
		extra: `${pc.dim(`(gzip ${formatBytes(bundle.gzip)})`)}${bytecode}`,
	};
}

function formatLimit(bytes: number) {
	return formatBytes(bytes).replace('.0 ', ' ');
}

function warningText(warning: ReportWarning): string {
	if (warning.kind === 'budget') {
		return `${warning.budget} over ${formatLimit(warning.limit)} budget (${formatBytes(warning.bytes)})`;
	}

	const listed = warning.modules.slice(0, LISTED_MODULES).join(', ');
	const more =
		warning.modules.length > LISTED_MODULES
			? ` +${warning.modules.length - LISTED_MODULES} more`
			: '';

	return `bundles ${warning.library} from node_modules (${listed}${more}); import it from '${warning.library}' so the client's shim provides it`;
}

function warningLine(warning: ReportWarning, strict: boolean) {
	const text = warningText(warning);

	return strict && warning.kind === 'budget' ? pc.red(`  ✖ ${text}`) : pc.yellow(`  ⚠ ${text}`);
}

/**
 * @description Renders a plugin's build report as the compact table `ubd build` prints.
 * @param report The report.
 * @param options Whether to list the largest modules, and whether budget warnings are errors.
 * @returns The table, one line per measured output, then each warning.
 */
export function formatReport(
	report: BuildReport,
	{ verbose = false, strict = false }: ReportFormatOptions = {},
): string {
	const sections: [string, Row[]][] = [
		['bundle', [bundleRow(report)]],
		['inlined', report.inlined.map(groupRow)],
		['shipped', report.shipped.map(groupRow)],
		['metro', report.metro.map(groupRow)],
		[
			'modules',
			verbose
				? report.modules.map(({ id, bytes }) => ({ label: id, size: formatBytes(bytes) }))
				: [],
		],
	];

	// Sizes line up under the longest label, such as a deep module path under `--verbose`.
	const labelWidth = Math.max(
		LABEL_WIDTH,
		...sections.flatMap(([, rows]) =>
			rows.filter((row) => row.size).map((row) => row.label.length + 1),
		),
	);

	return [
		`${pc.bold(report.name)} ${report.version}`.trimEnd(),
		...sections.flatMap(([section, rows]) => renderSection(section, rows, labelWidth)),
		...report.warnings.map((warning) => warningLine(warning, strict)),
	].join('\n');
}

/**
 * @description Renders a plugin's build report as the one line `ubd dev` prints per rebuild.
 * @param report The report.
 * @returns The bundle size, then each issue a feature counted and each warning, such as `18.4 KB · 1 uncached filter`.
 */
export function formatSummary(report: BuildReport): string {
	const groups = [...report.inlined, ...report.shipped, ...report.metro];
	const issues = groups.flatMap((group) =>
		Object.entries(group.issues).map(([noun, count]) => `${count} ${plural(noun, count)}`),
	);
	const warnings = report.warnings.map((warning) =>
		warning.kind === 'budget' ? `over ${warning.budget} budget` : `bundles ${warning.library}`,
	);

	return [formatBytes(report.bundle.bytes), ...issues, ...warnings].join(' · ');
}

/**
 * @description Tells whether a report breaks a budget, which `--strict-budget` turns into a failed build.
 * @param report The report.
 * @returns Whether any budget warning is present.
 */
export function isOverBudget(report: BuildReport): boolean {
	return report.warnings.some((warning) => warning.kind === 'budget');
}

export default { formatReport, formatSummary, isOverBudget };
