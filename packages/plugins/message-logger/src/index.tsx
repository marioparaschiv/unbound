import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { startHistory, stopHistory } from '~/history';
import { ChatManager, RowManager } from '~/rows/modules';
import { createMessageLog, type MessageLog } from '~/log';
import { ActionSheets } from '~/history/modules';
import { startDeletions } from '~/deletions';
import { MessageStore } from '~/log/modules';
import { purgeLog } from '~/history/actions';
import { startNonces } from '~/nonces';
import { startEdits } from '~/edits';
import { startRows } from '~/rows';
import { PLUGIN_NAME } from '~/constants';

let log: MessageLog | undefined;

export function start() {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets, ChatManager, MessageStore, RowManager })) {
		return;
	}

	log = createMessageLog();

	startRows(log);
	startDeletions(log);
	startEdits(log);
	startNonces();
	startHistory(log);
}

export function stop() {
	stopHistory();

	if (log) purgeLog(log);

	log = undefined;
}

export { featureSelfTest as selfTest };
