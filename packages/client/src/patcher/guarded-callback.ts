import { createLogger } from '@unbound-app/logger';
import type { PatchCallback } from 'possess';

import { FAILURE_LIMIT, removeFailingPatch, type PatchFailures } from '~/patcher/patch-failures';

const logger = createLogger('Patcher', 'Function');

/**
 * @description Wraps a function patch's callback so a throw names its patch, and the third throw in a row removes the
 * patch. The error is rethrown, so the patch library still falls back to Discord's own behaviour for that call.
 * @param callback The patch's callback.
 * @param name The patch, as `<caller> <method>`.
 * @param unpatch Removes the patch.
 * @returns The guarded callback.
 */
export function guardedCallback(
	callback: PatchCallback,
	name: string,
	unpatch: () => void,
): PatchCallback {
	const failures: PatchFailures = { name, count: 0, unstable: false, unpatch };

	return function guarded(
		this: ThisParameterType<PatchCallback>,
		...args: Parameters<PatchCallback>
	) {
		try {
			const result = callback.apply(this, args);

			failures.count = 0;

			return result;
		} catch (error) {
			failures.count++;
			logger.error(`Failed to run patch ${name}:`, error);

			if (failures.count === FAILURE_LIMIT) {
				removeFailingPatch(failures);
			}

			throw error;
		}
	} as PatchCallback;
}
