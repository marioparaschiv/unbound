import { createLogger } from '@unbound-app/logger';

/** One React patch's run of consecutive render failures. */
export type PatchFailures = {
	/** The patched component's name, for the log and toast. */
	name: string;
	/** Failures since the patch last rendered cleanly. */
	count: number;
	/** Set by the first failure: from then on each render keeps an untouched copy of Discord's tree to fall back to. */
	unstable: boolean;
	unpatch: () => void;
};

/** How many failures in a row remove a patch. */
export const FAILURE_LIMIT = 3;

const logger = createLogger('Patcher', 'React');

const UPDATE_LOOP = /Maximum update depth exceeded|Minified React error #185\b/;

/**
 * @description Tells whether React stopped a component that kept updating itself, which only gets worse on each retry.
 * @param cause What the patch or its tree threw.
 * @returns Whether it is React's "Maximum update depth exceeded" error, in full or minified.
 */
export function isUpdateLoop(cause: unknown): boolean {
	return cause instanceof Error && UPDATE_LOOP.test(cause.message);
}

/**
 * @description Counts a patch's render failure, removing the patch and showing a toast on its third in a row, or at once
 * when React stopped it for updating itself in a loop.
 * @param failures The patch's failure count.
 * @param cause What the patch or its tree threw.
 */
export function recordFailure(failures: PatchFailures, cause: unknown): void {
	if (failures.count >= FAILURE_LIMIT) return;

	failures.unstable = true;

	if (isUpdateLoop(cause)) {
		failures.count = FAILURE_LIMIT;
		logger.error(
			`Failed to render patch on component ${failures.name}: it updates itself in a loop, so it is removed now.`,
			cause,
		);
		removeFailingPatch(failures);

		return;
	}

	failures.count++;
	logger.error(`Failed to render patch on component ${failures.name}:`, cause);

	if (failures.count !== FAILURE_LIMIT) return;

	removeFailingPatch(failures);
}

/**
 * @description Removes a patch that failed too often in a row and tells the user which one.
 * @param failures The patch's failure count.
 */
export function removeFailingPatch(failures: PatchFailures): void {
	failures.unpatch();

	// Imported here: the toasts pull in React Native and i18n, which the patcher loads before.
	import('~/toasts/api')
		.then(({ warning }) => warning('UNBOUND_PATCH_REMOVED', { name: failures.name }))
		.catch((error) =>
			logger.error(`Failed to show removal toast for ${failures.name}:`, error),
		);
}

/**
 * @description Resets a patch's failure count once its tree commits cleanly.
 * @param failures The patch's failure count.
 */
export function recordSuccess(failures: PatchFailures): void {
	failures.count = 0;
}
