import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
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

	// One call per feature, so a feature that throws is logged and recorded while the others still start.
	disposeRows = applyFeatures(PLUGIN_NAME, [() => startRows(current)]);
	applyFeatures(PLUGIN_NAME, [() => startDeletions(current)]);
	applyFeatures(PLUGIN_NAME, [() => startEdits(current)]);
	applyFeatures(PLUGIN_NAME, [startNonces]);
	disposeHistory = applyFeatures(PLUGIN_NAME, [() => startHistory(current)]);
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
