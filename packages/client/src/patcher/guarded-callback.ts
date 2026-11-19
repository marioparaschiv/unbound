import { createLogger } from '@unbound-app/logger';
import type { PatchCallback } from 'possess';

import { FAILURE_LIMIT, removeFailingPatch, type PatchFailures } from '~/patcher/patch-failures';

const logger = createLogger('Patcher', 'Function');
const overflows = new WeakSet<object>();

function isStackOverflow(error: unknown): error is RangeError {
	return error instanceof RangeError && /call stack/i.test(error.message);
}

function reportOverflow(error: RangeError, failures: PatchFailures) {
	if (overflows.has(error)) return;

	overflows.add(error);
	logger.error(
		`Failed to run patch ${failures.name}: it recursed until the stack ran out, so it was removed. It likely calls the method it patches.`,
		error,
	);
	removeFailingPatch(failures);
}

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
			if (isStackOverflow(error)) {
				reportOverflow(error, failures);

				throw error;
			}

			failures.count++;
			logger.error(`Failed to run patch ${name}:`, error);

			if (failures.count === FAILURE_LIMIT) {
				removeFailingPatch(failures);
			}

			throw error;
		}
	} as PatchCallback;
}
