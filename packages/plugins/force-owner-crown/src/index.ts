import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchOwnerCrown } from '~/patches/message-row-data';
import { GuildStore, MessageRowData } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Force Owner Crown', { MessageRowData, GuildStore })) return;

	dispose = applyFeatures('Force Owner Crown', [patchOwnerCrown]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
