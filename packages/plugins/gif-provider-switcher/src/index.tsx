import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { interceptGifRequests } from '~/requests';
import { patchGifPickerHeader } from '~/picker';
import SettingsPanel from '~/settings';
import { PickerRunning } from '~/modules';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	dispose = applyFeatures(PLUGIN_NAME, [
		PickerRunning.markRunning,
		interceptGifRequests,
		patchGifPickerHeader,
	]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
