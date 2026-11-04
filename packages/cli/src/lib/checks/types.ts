import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import { diagnostic, withoutFullStop } from '~/rollup/diagnostic';
import type { Diagnostic } from '~/rollup/diagnostic';
import type { TscDiagnostic } from '~/lib/check/tsc';
import type { Check } from '~/lib/check/check';
import { runTsc } from '~/lib/check/tsc';

/**
 * @description Converts tsc's diagnostics into check diagnostics.
 * @param diagnostics What the compiler reported, with files relative to the addon.
 * @returns One diagnostic per compiler error or warning.
 */
export function toTypeDiagnostics(diagnostics: readonly TscDiagnostic[]): Diagnostic[] {
	return diagnostics.map((found) =>
		diagnostic({
			file: found.file?.split('\\').join('/') ?? 'tsconfig.json',
			line: found.line,
			column: found.column,
			severity: found.severity,
			message: `${withoutFullStop(found.message)} (TS${found.code})`,
		}),
	);
}

/**
 * @description Finds the `tsconfig.json` that governs a directory, as `tsc` looks for one.
 * @param dir The directory to start from.
 * @returns The config's path, or undefined when no directory up to the root has one.
 */
function findConfig(dir: string): string | undefined {
	for (let current = dir; ; current = dirname(current)) {
		const path = join(current, 'tsconfig.json');

		if (existsSync(path)) {
			return path;
		}

		if (dirname(current) === current) {
			return void 0;
		}
	}
}

export const typesCheck: Check = {
	id: 'types',
	/**
	 * @description Type-checks the addon with its `tsconfig.json` through TypeScript 7's `tsc --noEmit -p`.
	 * Slow, so `ubd check` runs it only with `--types`.
	 * @param context The addon to check.
	 * @returns One diagnostic per type error; none for an addon without a tsconfig.
	 */
	async run({ addon }) {
		const configPath = findConfig(addon.dir);

		if (!configPath) {
			return [];
		}

		const { diagnostics, failure } = await runTsc(['--noEmit', '-p', configPath], addon.dir);

		if (failure) {
			return [
				diagnostic({
					file: 'tsconfig.json',
					severity: 'error',
					message: `Failed to type-check ${addon.dir}: ${failure}`,
				}),
			];
		}

		return toTypeDiagnostics(diagnostics);
	},
};

export default { toTypeDiagnostics, typesCheck };
