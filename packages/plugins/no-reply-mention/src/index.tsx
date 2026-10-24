import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchPendingReplyActions } from '~/patches/pending-reply-actions';
import SettingsPanel from '~/components/settings-panel';
import { PendingReplyActions } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('No Reply Mention', { PendingReplyActions })) return;

	dispose = applyFeatures('No Reply Mention', [patchPendingReplyActions]);
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
