import { isAbsolute, relative, sep } from 'node:path';
import type { PluginContext } from 'rollup';

// An addon build loads this folder from the addon's directory, where `~/` maps to the addon's own src.
/* oxlint-disable oxc-config/consistent-import-paths -- see above */
import {
	diagnostic,
	formatDiagnostic,
	type Diagnostic,
	type DiagnosticInit,
	type Severity,
} from '../lib/check/diagnostic.ts';
/* oxlint-enable oxc-config/consistent-import-paths */

// The rollup folder's own modules and its public entry read the diagnostic core through here.
export { diagnostic, formatDiagnostic, type Diagnostic, type Severity };

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

export default { reportDiagnostic, pluginDiagnostic, reportProblem, reportDiagnostics };
