import toError from '@unbound-app/utils/to-error';

import type { Check, CheckCache, CheckContext } from '~/lib/check/check';
import type { Diagnostic } from '~/lib/check/diagnostic';
import { sortDiagnostics } from '~/lib/check/diagnostic';
import type { DiscoveredAddon } from '~/lib/discovery';

/** Every diagnostic the checks found in one addon, sorted for printing. */
export type AddonDiagnostics = {
	addon: DiscoveredAddon;
	diagnostics: Diagnostic[];
};

export type RunOptions = {
	emit: boolean;
	cache: CheckCache;
};

/**
 * @description Runs the checks on an addon in parallel. A check that throws reports one error
 * naming it instead of stopping the others.
 * @param addon The addon to check.
 * @param checks The checks to run; each starts in order.
 * @param options Whether to write derived files, and the caches to share across runs.
 * @returns The addon's diagnostics, each tagged with the check that found it.
 */
export async function runChecks(
	addon: DiscoveredAddon,
	checks: readonly Check[],
	{ emit, cache }: RunOptions,
): Promise<AddonDiagnostics> {
	const context: CheckContext = { addon, emit, cache };
	const found = await Promise.all(checks.map((check) => runCheck(check, context)));

	return { addon, diagnostics: sortDiagnostics(found.flat()) };
}

async function runCheck(check: Check, context: CheckContext): Promise<Diagnostic[]> {
	try {
		const diagnostics = await check.run(context);

		return diagnostics.map((diagnostic) => ({
			...diagnostic,
			check: diagnostic.check ?? check.id,
		}));
	} catch (error) {
		return [
			{
				file: '',
				line: 0,
				column: 0,
				severity: 'error',
				message: `The ${check.id} check crashed: ${toError(error).message}`,
				check: check.id,
			},
		];
	}
}

/**
 * @description Tells whether diagnostics fail a run.
 * @param diagnostics The diagnostics.
 * @param strict Whether warnings fail it too.
 * @returns Whether any diagnostic fails it.
 */
export function hasFailures(diagnostics: readonly Diagnostic[], strict = false): boolean {
	return diagnostics.some((diagnostic) => strict || diagnostic.severity === 'error');
}

export default { runChecks, hasFailures };
