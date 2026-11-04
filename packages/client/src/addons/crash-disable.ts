import type { createLogger } from '@unbound-app/logger';

import { crashDisabledNotice, crashedAddon, crashGuardKey } from '~/addons/crash-guard';
import { crashReportAddon } from '~/diagnostics/crash-report';
import { reportCrash } from '~/diagnostics/crash-reports';
import type { Addon } from '~/addons/addon';

/**
 * @description Disables an addon the loader reported crashing Discord on consecutive launches: turns it off
 * through `disable`, says why in the log, and reports the crash.
 * @param entity The addon about to start.
 * @param bucket Its manager's bucket, which names its crash guard key.
 * @param logger Its manager's logger.
 * @param disable Persists the addon as off.
 * @returns Whether the addon was disabled instead of started.
 */
export function disableIfCrashed(
	entity: Addon,
	bucket: string,
	logger: ReturnType<typeof createLogger>,
	disable: () => void,
): boolean {
	const crashed = crashedAddon(crashGuardKey(bucket, entity.id));

	if (!crashed) {
		return false;
	}

	disable();
	logger.warn(crashDisabledNotice(crashed, entity.name));
	void reportCrash({
		kind: crashed.phase === 'frozen' ? 'freeze' : 'crash',
		phase: crashed.phase,
		addon: crashReportAddon(entity),
	});

	return true;
}

export default disableIfCrashed;
