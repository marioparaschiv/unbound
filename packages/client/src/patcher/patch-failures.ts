import { createLogger } from '@unbound-app/logger';

/** One React patch's run of consecutive render failures. */
export type PatchFailures = {
	/** The patched component's name, for the log and toast. */
	name: string;
	/** Failures since the patch last rendered cleanly. */
	count: number;
	/** Set by the first failure: from then on each render keeps an untouched copy of Discord's tree to fall back to. */
	unstable: boolean;
	/** Removes the patch. */
	unpatch: () => void;
};

/** How many failures in a row remove a patch. */
export const FAILURE_LIMIT = 3;

const logger = createLogger('Patcher', 'React');

/**
 * @description Counts a patch's render failure, removing the patch and showing a toast on its third in a row.
 * @param failures The patch's failure count.
 * @param cause What the patch or its tree threw.
 */
export function recordFailure(failures: PatchFailures, cause: unknown): void {
	failures.count++;
	failures.unstable = true;
	logger.error(`Failed to render patch on component ${failures.name}:`, cause);

	if (failures.count !== FAILURE_LIMIT) return;

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
