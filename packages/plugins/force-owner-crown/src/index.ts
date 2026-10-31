import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchOwnerCrown } from '~/patches/message-row-data';
import { GuildStore, MessageRowData } from '~/modules';

function start() {
	if (!ensureModules('Force Owner Crown', { MessageRowData, GuildStore })) return;

	patchOwnerCrown();
	recordApplied(1);
}

export default { start, selfTest: featureSelfTest };
