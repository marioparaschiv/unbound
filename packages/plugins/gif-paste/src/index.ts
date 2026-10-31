import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { MessageActions, PendingReplyStore, ReplyActions } from '~/modules';
import { patchMessageActions } from '~/patches/message-actions';
import { patchReplyActions } from '~/patches/reply-actions';
import { createKeptReplies } from '~/kept-replies';

let dispose = () => {};

function start() {
	if (!ensureModules('GIF Paste', { MessageActions, ReplyActions, PendingReplyStore })) return;

	const keptReplies = createKeptReplies();

	dispose = applyFeatures('GIF Paste', [
		() => patchReplyActions(keptReplies),
		() => patchMessageActions(keptReplies),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop, selfTest: featureSelfTest };
