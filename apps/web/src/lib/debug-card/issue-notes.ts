import type { DebugCardRequest as DebugInfo } from '@unbound-app/contracts/debug-cards';

/**
 * @description Lists hook problems: libffi closures failing the launch probe, then hooks that failed to install newest first, as `addon: target`.
 * @param info The report.
 * @returns One note per problem.
 */
export function hookNotes(
	info: Pick<DebugInfo, 'ffiClosures' | 'ffiClosureProbe' | 'hookFailures'>,
): string[] {
	const failures = (info.hookFailures ?? [])
		.toReversed()
		.map((failure) => `${failure.addon}: ${failure.target}`);

	const blocked = info.ffiClosureProbe
		? `libffi closures blocked (${info.ffiClosureProbe})`
		: 'libffi closures blocked';

	return info.ffiClosures === false ? [blocked, ...failures] : failures;
}

/**
 * @description Lists recent errors newest first, each prefixed with its addon.
 * @param errors The recent errors.
 * @returns One note per error.
 */
export function errorNotes(errors: DebugInfo['errors'] = []): string[] {
	return errors
		.toReversed()
		.map((error) => (error.addon ? `${error.addon}: ${error.message}` : error.message));
}
