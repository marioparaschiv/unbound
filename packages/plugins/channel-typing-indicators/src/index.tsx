import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
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

let markStopped = () => {};

function start() {
	if (!ensureModules('Channel Typing Indicators', { Theme })) return;

	const stores = [TypingStoreFilter, UserStoreFilter];

	markStopped = IndicatorsRunning.markRunning();
	whenAllLoaded([...stores, TextChannelPath], patchTextChannel);
	whenAllLoaded([...stores, ThreadChannelPath], patchThreadChannel);
	recordApplied(3);
}

function stop() {
	markStopped();
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
