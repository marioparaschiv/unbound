import type { DebugCardRequest as DebugInfo } from '@unbound-app/contracts/debug-cards';

/**
 * @description Lists hooks that failed to install newest first, each as `addon: target`.
 * @param failures The hook failures.
 * @returns One note per failure.
 */
export function hookNotes(failures: DebugInfo['hookFailures'] = []): string[] {
	return failures.toReversed().map((failure) => `${failure.addon}: ${failure.target}`);
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
