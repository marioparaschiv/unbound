import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ActionSheets, ChannelStore, PermissionStore, REST, UserStore } from '~/modules';
import { patchActionSheets } from '~/patches/action-sheets';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	if (
		!ensureModules(PLUGIN_NAME, {
			ActionSheets,
			REST,
			ChannelStore,
			PermissionStore,
			UserStore,
		})
	) {
		return;
	}

	dispose = applyFeatures(PLUGIN_NAME, [patchActionSheets]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest };
