import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { interceptNonceReplacements } from '~/nonces';
import { interceptDeletes } from '~/deletions';
import { interceptEdits } from '~/edits';
import { patchActionSheets } from '~/history';
import { patchChatManager } from '~/rows/change-type';
import { patchRowManager } from '~/rows';
import SettingsPanel from '~/settings';
import { ActionSheets, ChatManager, MessageStore, RowManager } from '~/discord/modules';
import { PLUGIN_NAME } from '~/constants';
import { createMessageLog } from '~/log';
import { purgeLog } from '~/history/actions';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets, ChatManager, MessageStore, RowManager }))
		return;

	const log = createMessageLog();

	dispose = applyFeatures(PLUGIN_NAME, [
		() => () => purgeLog(log),
		() => patchRowManager(log),
		() => patchChatManager(log),
		() => interceptDeletes(log),
		() => interceptEdits(log),
		() => interceptNonceReplacements(),
		() => patchActionSheets(log),
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
