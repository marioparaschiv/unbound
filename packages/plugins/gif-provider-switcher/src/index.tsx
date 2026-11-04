import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import startFeatures from '@unbound-plugins/shared/lifecycle/start-features';

import { startRequests, stopRequests } from '~/requests';
import { startPicker, stopPicker } from '~/picker';

let stopFeatures = async () => {};

export function start() {
	// One feature throwing must not cost the other.
	stopFeatures = startFeatures('GIF Provider Switcher', [
		() => {
			startPicker();

			return stopPicker;
		},
		() => {
			startRequests();

			return stopRequests;
		},
	]);
}

export function stop() {
	return stopFeatures();
}

export { featureSelfTest as selfTest };
