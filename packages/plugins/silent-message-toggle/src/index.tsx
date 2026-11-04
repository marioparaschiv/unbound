import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { assets } from '@unbound-app/api';

import { resetOnChannelSwitch } from '~/patches/selected-channel-store';
import { patchMessageActions } from '~/patches/message-actions';
import { patchToggleButton } from '~/patches/platform';
import SettingsPanel from '~/components/settings-panel';
import { Messages, SelectedChannelStore, SilentToggle, ToggleRunning } from '~/modules';
import { Icons, PLUGIN_NAME } from '~/constants';

let dispose: () => unknown = () => undefined;

export function start() {
	const on = assets.getIdByName(Icons.on);
	const off = assets.getIdByName(Icons.off);

	if (!ensureModules(PLUGIN_NAME, { Messages, SelectedChannelStore })) return;

	if (on === undefined || off === undefined) {
		console.error(`[${PLUGIN_NAME}] Skipped, the bell icon assets were not found.`);

		return;
	}

	dispose = applyFeatures(PLUGIN_NAME, [
		() => SilentToggle.reset,
		ToggleRunning.markRunning,
		patchMessageActions,
		resetOnChannelSwitch,
		() => patchToggleButton({ on, off }),
	]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest, SettingsPanel };
