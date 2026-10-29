import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ChannelStore, GuildMemberStore, MessageRowData } from '~/modules';
import { patchTimeoutDurations } from '~/patches/message-row-data';

let dispose = () => {};

function start() {
	if (
		!ensureModules('Show Timeout Duration', { MessageRowData, GuildMemberStore, ChannelStore })
	) {
		return;
	}

	dispose = applyFeatures('Show Timeout Duration', [patchTimeoutDurations]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop, selfTest: featureSelfTest };
