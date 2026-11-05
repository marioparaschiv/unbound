import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ChatManager, RowManager } from '~/rows/modules';
import { createMessageLog, type MessageLog } from '~/log';
import { ActionSheets } from '~/history/modules';
import { startDeletions } from '~/deletions';
import { MessageStore } from '~/log/modules';
import { purgeLog } from '~/history/actions';
import { startHistory } from '~/history';
import { startNonces } from '~/nonces';
import { startEdits } from '~/edits';
import { startRows } from '~/rows';
import { PLUGIN_NAME } from '~/constants';

let log: MessageLog | undefined;
let disposeHistory: (() => unknown) | undefined;
let disposeRows: (() => unknown) | undefined;

export function start() {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets, ChatManager, MessageStore, RowManager })) {
		return;
	}

	const current = createMessageLog();

	log = current;

	// Rows and history keep their stop for `stop`; the interceptors stay on until the Addon scope removes them.
	disposeRows = startFeatures(PLUGIN_NAME, [() => startRows(current)]);
	startFeatures(PLUGIN_NAME, [
		() => startDeletions(current),
		() => startEdits(current),
		startNonces,
	]);
	disposeHistory = startFeatures(PLUGIN_NAME, [() => startHistory(current)]);
}

export function stop() {
	disposeHistory?.();
	// The row patches go before the purge, which makes Discord draw the rows again; the interceptors stay for it.
	disposeRows?.();

	if (log) purgeLog(log);

	log = undefined;
	disposeHistory = undefined;
	disposeRows = undefined;
}

export { featureSelfTest as selfTest };
