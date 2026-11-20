import type { DebugCardRequest as DebugInfo } from '@unbound-app/contracts/debug-cards';

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
