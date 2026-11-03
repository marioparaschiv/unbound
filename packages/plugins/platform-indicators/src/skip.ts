import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';

import { PLUGIN_NAME } from '~/constants';

/**
 * @description Logs that a feature skipped patching and records it, so the self test reports the skip.
 * @param reason Why the feature skipped.
 */
export function skip(reason: string): void {
	console.error(`[${PLUGIN_NAME}] Skipped ${reason}.`);
	recordSkip(reason);
}

export default skip;
