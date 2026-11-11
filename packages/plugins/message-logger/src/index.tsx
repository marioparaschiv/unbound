import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ChatManager, RowManager } from '~/rows/modules';
import { ActionSheets } from '~/history/modules';
import { startDeletions } from '~/deletions';
import { MessageStore } from '~/log/modules';
import { purgeLog } from '~/history/actions';
import { createMessageLog } from '~/log';
import { startHistory } from '~/history';
import { startNonces } from '~/nonces';
import { startPersistence } from '~/persist';
import { startEdits } from '~/edits';
import { startRows } from '~/rows';

export const { start, stop, selfTest } = runFeatures(() => {
	if (!ensureModules({ ActionSheets, ChatManager, MessageStore, RowManager })) return;

	let save = () => {};
	const log = createMessageLog(() => save());

	// Features end in reverse: saving first, so the purge clears the chat but leaves the saved log; then history,
	// then the row patches before the purge, which makes Discord draw the rows again.
	// The interceptors have nothing to end and stay for it, until the Addon scope removes them.
	return [
		() => () => purgeLog(log),
		() => startDeletions(log),
		() => startEdits(log),
		startNonces,
		() => startRows(log),
		() => startHistory(log),
		() => {
			const persistence = startPersistence(log);

			save = persistence.save;

			return persistence.stop;
		},
	];
});
