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
 * @description Lists each recent error in full, newest first, for the alt text.
 * @param errors The recent errors.
 * @returns One line per error, prefixed with its addon.
 */
export function errorDetails(errors: DebugInfo['errors'] = []): string[] {
	return errors
		.toReversed()
		.map((error) => (error.addon ? `${error.addon}: ${error.message}` : error.message));
}

const ERROR_NAME = /\b([A-Z]\w*(?:Error|Exception))\b/;

function errorKind(message: string): string {
	return ERROR_NAME.exec(message)?.[1] ?? 'Error';
}

/**
 * @description Groups the recent errors by addon and error type, newest first, such as `Chat Bubbles TypeError ×2`.
 * @param errors The recent errors.
 * @returns One note per addon and error type.
 */
export function errorNotes(errors: DebugInfo['errors'] = []): string[] {
	const counts = new Map<string, number>();

	for (const error of errors.toReversed()) {
		const note = `${error.addon ?? 'unbound'} ${errorKind(error.message)}`;

		counts.set(note, (counts.get(note) ?? 0) + 1);
	}

	return [...counts].map(([note, count]) => (count > 1 ? `${note} ×${count}` : note));
}
