import { dirname, join, relative, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';

import { diagnostic, withoutFullStop } from '~/rollup/diagnostic';
import type { Diagnostic, Severity } from '~/rollup/diagnostic';
import { Type, type StaticDecode } from '~/lib/schema';
import type { Check } from '~/lib/check/check';
import { parseJson } from '~/lib/parse-json';

const CONFIG_FILE = '.oxlintrc.json';
const BINARY = join('node_modules', '.bin', 'oxlint');
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

const lintOutputSchema = Type.Object({
	diagnostics: Type.Array(
		Type.Object({
			message: Type.String(),
			code: Type.Optional(Type.String()),
			severity: Type.String(),
			help: Type.Optional(Type.String()),
			filename: Type.String(),
			labels: Type.Array(
				Type.Object({
					span: Type.Object({ line: Type.Number(), column: Type.Number() }),
				}),
			),
		}),
	),
});

export type LintOutput = StaticDecode<typeof lintOutputSchema>;

/** Where to run oxlint for an addon: the binary, and the config with the directory it resolves from. */
export type LintSetup = {
	binary: string;
	config?: string;
	cwd: string;
};

function findUp(from: string, name: string): string | undefined {
	for (let dir = resolve(from); ; dir = dirname(dir)) {
		if (existsSync(join(dir, name))) {
			return join(dir, name);
		}

		if (dirname(dir) === dir) {
			return void 0;
		}
	}
}

/**
 * @description Finds the oxlint binary and the nearest `.oxlintrc.json` for an addon, the ones
 * `oxlint` run from the addon's workspace uses.
 * @param dir The addon's directory.
 * @returns The setup, or `undefined` when oxlint is not installed.
 */
export function findLintSetup(dir: string): LintSetup | undefined {
	const binary = findUp(dir, BINARY);

	if (!binary) {
		return void 0;
	}

	const config = findUp(dir, CONFIG_FILE);

	return { binary, config, cwd: config ? dirname(config) : dir };
}

/**
 * @description Converts oxlint's JSON report into diagnostics, with files relative to the addon.
 * @param output The parsed report.
 * @param cwd The directory oxlint ran in, which its file names are relative to.
 * @param dir The addon's directory.
 * @returns One diagnostic per lint finding.
 */
export function toLintDiagnostics(output: LintOutput, cwd: string, dir: string): Diagnostic[] {
	return output.diagnostics.map((finding) => {
		const span = finding.labels[0]?.span;
		const severity: Severity = finding.severity === 'error' ? 'error' : 'warning';
		const rule = finding.code ? ` (${finding.code})` : '';

		return diagnostic({
			file: relative(dir, resolve(cwd, finding.filename)).split(sep).join('/'),
			line: span?.line,
			column: span?.column,
			severity,
			message: `${withoutFullStop(finding.message)}${rule}`,
			fix: finding.help,
		});
	});
}

function runOxlint({ binary, config, cwd }: LintSetup, target: string): Promise<string> {
	const args = [...(config ? ['-c', config] : []), '--format', 'json', target];

	return new Promise((done, fail) => {
		// oxlint exits 1 when it finds errors; only a missing report is a failure.
		execFile(binary, args, { cwd, maxBuffer: MAX_OUTPUT_BYTES }, (error, stdout, stderr) => {
			if (stdout.trim()) {
				done(stdout);
			} else {
				fail(new Error(stderr.trim() || error?.message || 'oxlint printed nothing.'));
			}
		});
	});
}

export const lintCheck: Check = {
	id: 'lint',
	/**
	 * @description Runs oxlint over the addon with the nearest `.oxlintrc.json`, the plugin lint
	 * `docs/developer/getting-started/project-rules.mdx` describes.
	 * @param context The addon to check.
	 * @returns One diagnostic per lint finding, or a warning when oxlint is not installed; none for a theme.
	 */
	async run({ addon }) {
		if (addon.kind !== 'plugin') {
			return [];
		}

		const setup = findLintSetup(addon.dir);

		if (!setup) {
			return [
				diagnostic({
					file: '',
					severity: 'warning',
					message: 'oxlint is not installed, so the plugin lint did not run',
					fix: 'add oxlint to the devDependencies',
				}),
			];
		}

		const text = await runOxlint(setup, relative(setup.cwd, addon.dir) || '.');
		const parsed = parseJson(text, lintOutputSchema, 'oxlint');

		if (!parsed.ok) {
			throw new Error(parsed.error);
		}

		return toLintDiagnostics(parsed.value, setup.cwd, addon.dir);
	},
};

export default { findLintSetup, toLintDiagnostics, lintCheck };
