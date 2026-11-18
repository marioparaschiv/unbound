import type { DebugCardRequest as DebugInfo } from '@unbound-app/contracts/debug-cards';

/**
 * @description Lists hook problems: libffi closures failing the launch probe, hooks that failed to install newest first as
 * `addon: target`, methods two plugins rewrite as `addon × addon · target`, then methods another tweak replaced over a
 * plugin's hook as `replaced by image · target`.
 * @param info The report.
 * @returns One note per problem.
 */
export function hookNotes(
	info: Pick<
		DebugInfo,
		'ffiClosures' | 'ffiClosureProbe' | 'hookFailures' | 'hookConflicts' | 'foreignHooks'
	>,
): string[] {
	const failures = (info.hookFailures ?? [])
		.toReversed()
		.map((failure) => `${failure.addon}: ${failure.target}`);

	const blocked = info.ffiClosureProbe
		? `libffi closures blocked (${info.ffiClosureProbe})`
		: 'libffi closures blocked';

	const conflicts = [
		...(info.hookConflicts ?? []),
		...(info.foreignHooks ?? []).map((hook) => `replaced by ${hook}`),
	];

	return info.ffiClosures === false
		? [blocked, ...failures, ...conflicts]
		: [...failures, ...conflicts];
}

/**
 * @description Lists each recent error in full, newest first, for the alt text.
 * @param errors The recent errors.
 * @returns One line per error, prefixed with its addon.
 */
export function errorDetails(errors: DebugInfo['errors'] = []): string[] {
	return errors
		.toReversed()
		.map((error) => (error.addon ? `${error.addon}: ${error.message}` : error.message));
}
