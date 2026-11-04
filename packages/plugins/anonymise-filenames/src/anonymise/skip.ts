import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';

/**
 * @description Logs that a feature skipped patching and records it, so the self test reports the skip.
 * @param reason Why the feature skipped.
 */
export function skip(reason: string): void {
	logger.error(`Skipped ${reason}.`);
	recordSkip(reason);
}
