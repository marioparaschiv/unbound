import { isAbsolute, relative, sep } from 'node:path';
import type { PluginContext } from 'rollup';

export type Severity = 'error' | 'warning';

/** One problem a check found, at a place in one of the addon's files. */
export type Diagnostic = {
	/** The file, relative to the addon's directory, with `/` separators. */
	file: string;
	/** 1-based; 0 when the problem belongs to the whole file. */
	line: number;
	/** 1-based; 0 when the problem belongs to the whole file. */
	column: number;
	/** Where in the file's data the problem sits, such as a settings key or a manifest field. */
	path?: string;
	severity: Severity;
	message: string;
	fix?: string;
	/** The check that found it; the runner fills in the check's id when a check leaves it out. */
	check?: string;
};

/** Where and how bad a diagnostic is, for building one without spelling out every field. */
export type DiagnosticInit = Omit<Diagnostic, 'line' | 'column'> & {
	line?: number;
	column?: number;
};

const SEVERITIES: readonly string[] = ['error', 'warning'] satisfies Severity[];

/**
 * @description Builds a diagnostic, placing it on the whole file when it has no line.
 * @param init The diagnostic's fields.
 * @returns The diagnostic.
 */
export function diagnostic({ line = 0, column = 0, ...rest }: DiagnosticInit): Diagnostic {
	return { ...rest, line, column };
}

/**
 * @description Tells whether a value is a diagnostic, such as one a rollup plugin carried in a log's `meta`.
 * @param value The value to test.
 * @returns Whether it has every field a diagnostic needs.
 */
// UNKNOWN: a rollup log's `meta` is whatever the plugin attached.
export function isDiagnostic(value: unknown): value is Diagnostic {
	if (!value || typeof value !== 'object') {
		return false;
	}

	return (
		'file' in value &&
		typeof value.file === 'string' &&
		'line' in value &&
		typeof value.line === 'number' &&
		'column' in value &&
		typeof value.column === 'number' &&
		'message' in value &&
		typeof value.message === 'string' &&
		'severity' in value &&
		typeof value.severity === 'string' &&
		SEVERITIES.includes(value.severity)
	);
}

/**
 * @description Drops a message's closing full stop, so a suffix such as a rule name can follow it.
 * @param text The message.
 * @returns The message without its closing full stop.
 */
export function withoutFullStop(text: string): string {
	const trimmed = text.trim();

	return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
}

function sentence(text: string): string {
	return `${withoutFullStop(text)}.`;
}

/**
 * @description Formats a diagnostic as `file:L:C  <path>  <problem>.  Fix: <fix>.`, the line every
 * check, `ubd build` and `ubd check` print.
 * @param diagnostic The diagnostic.
 * @param file The file as the reader should see it; defaults to the diagnostic's own.
 * @returns The line.
 */
export function formatDiagnostic(diagnostic: Diagnostic, file = diagnostic.file): string {
	const location = diagnostic.line ? `${file}:${diagnostic.line}:${diagnostic.column}` : file;
	const parts = [location, diagnostic.path, sentence(diagnostic.message)];

	if (diagnostic.fix) {
		parts.push(`Fix: ${sentence(diagnostic.fix)}`);
	}

	return parts.filter(Boolean).join('  ');
}

/**
 * @description Orders diagnostics by file, then errors before warnings, then by position.
 * @param diagnostics The diagnostics.
 * @returns A sorted copy.
 */
export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
	return diagnostics.toSorted(
		(a, b) =>
			a.file.localeCompare(b.file) ||
			SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
			a.line - b.line ||
			a.column - b.column ||
			a.message.localeCompare(b.message),
	);
}

/**
 * @description Reports a diagnostic from a rollup plugin hook: an error stops the build, a warning
 * does not. Rollup prints the formatted line, and `ubd check` reads the diagnostic back from the
 * log's `meta`, so both show the same problem the same way.
 * @param context The hook's `this`.
 * @param found The diagnostic, with its file relative to the plugin's directory.
 */
export function reportDiagnostic(
	context: Pick<PluginContext, 'warn' | 'error'>,
	found: Diagnostic,
): void {
	const log = { message: formatDiagnostic(found), meta: { diagnostic: found } };

	if (found.severity === 'error') {
		context.error(log);
	}

	context.warn(log);
}

/** A problem one of the preset's rollup plugins found; `file` may be absolute or relative to the plugin. */
export type PluginProblem = Omit<DiagnosticInit, 'check'>;

/**
 * @description Builds a preset plugin's diagnostic under its `ubd check` id, with the file and any absolute
 * path in the message made relative to the plugin, so `--only <check>` selects it.
 * @param check The check id, one of `BUNDLE_REPORTED_CHECKS`.
 * @param pluginRoot The plugin's directory.
 * @param problem The problem.
 * @returns The diagnostic.
 */
export function pluginDiagnostic(
	check: string,
	pluginRoot: string,
	problem: PluginProblem,
): Diagnostic {
	const file = isAbsolute(problem.file) ? relative(pluginRoot, problem.file) : problem.file;

	return diagnostic({
		...problem,
		file: file.split(sep).join('/'),
		message: problem.message.replaceAll(pluginRoot + sep, ''),
		check,
	});
}

/**
 * @description Reports a preset plugin's problem from a rollup hook, as {@link pluginDiagnostic} builds it.
 * @param context The hook's `this`.
 * @param check The check id, one of `BUNDLE_REPORTED_CHECKS`.
 * @param pluginRoot The plugin's directory.
 * @param problem The problem.
 */
export function reportProblem(
	context: Pick<PluginContext, 'warn' | 'error'>,
	check: string,
	pluginRoot: string,
	problem: PluginProblem,
): void {
	reportDiagnostic(context, pluginDiagnostic(check, pluginRoot, problem));
}

/**
 * @description Reports several diagnostics at once: each warning on its own, then every error in one failure,
 * whose `meta.diagnostics` `ubd check` reads back, so a build names all its errors rather than the first.
 * @param context The hook's `this`.
 * @param found The diagnostics.
 */
export function reportDiagnostics(
	context: Pick<PluginContext, 'warn' | 'error'>,
	found: readonly Diagnostic[],
): void {
	const errors = found.filter((item) => item.severity === 'error');

	for (const item of found) {
		if (item.severity === 'warning') {
			reportDiagnostic(context, item);
		}
	}

	if (errors.length === 1 && errors[0]) {
		reportDiagnostic(context, errors[0]);
	}

	if (errors.length > 1) {
		context.error({
			message: errors.map((item) => formatDiagnostic(item)).join('\n'),
			meta: { diagnostics: errors },
		});
	}
}

export default {
	diagnostic,
	isDiagnostic,
	formatDiagnostic,
	sortDiagnostics,
	reportDiagnostic,
	pluginDiagnostic,
	reportProblem,
	reportDiagnostics,
};
