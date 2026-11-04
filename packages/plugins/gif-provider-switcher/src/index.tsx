import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { interceptGifRequests } from '~/requests';
import { patchGifPickerHeader } from '~/picker';
import SettingsPanel from '~/settings';
import { PickerRunning } from '~/modules';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	dispose = applyFeatures(PLUGIN_NAME, [
		PickerRunning.markRunning,
		interceptGifRequests,
		patchGifPickerHeader,
	]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export { featureSelfTest as selfTest, SettingsPanel };
