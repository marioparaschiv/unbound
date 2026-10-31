import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchPendingReplyActions } from '~/patches/pending-reply-actions';
import SettingsPanel from '~/components/settings-panel';
import { PendingReplyActions } from '~/modules';

function start() {
	if (!ensureModules('No Reply Mention', { PendingReplyActions })) return;

	applyFeatures('No Reply Mention', [patchPendingReplyActions]);
}

export default {
	start,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
