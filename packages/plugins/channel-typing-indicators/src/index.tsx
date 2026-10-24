import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { whenAllLoaded } from '@unbound-plugins/shared/metro/when-loaded';

import { patchThreadChannel } from '~/patches/thread-channel';
import SettingsPanel from '~/components/settings-panel';
import { patchTextChannel } from '~/patches/text-channel';
import {
	IndicatorsRunning,
	TextChannelPath,
	Theme,
	ThreadChannelPath,
	TypingStoreFilter,
	UserStoreFilter,
} from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Channel Typing Indicators', { Theme })) return;

	const stores = [TypingStoreFilter, UserStoreFilter];

	dispose = applyFeatures('Channel Typing Indicators', [
		IndicatorsRunning.markRunning,
		() => whenAllLoaded([...stores, TextChannelPath], patchTextChannel),
		() => whenAllLoaded([...stores, ThreadChannelPath], patchThreadChannel),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
