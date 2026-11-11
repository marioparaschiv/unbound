import { patcher } from '@unbound-app/api';

import { interceptDeletions, interceptEdits, trackNonces } from '~/flux/interceptors';
import { patchMessageActions } from '~/patches/message-actions';
import { patchMessageRows } from '~/patches/message-rows';
import { startSaving, stopSaving } from '~/lib/persist';
import { closeHistorySheet } from '~/lib/sheet';
import { clearLog } from '~/lib/clear';

export function start() {
	interceptDeletions();
	interceptEdits();
	trackNonces();
	patchMessageRows();
	patchMessageActions();
	startSaving();
}

// Saving stops before the log clears, so the saved file keeps it. The row patches go first, so the cleared rows draw plain;
// the interceptors stay on for `clearLog` until the Addon scope removes them.
export function stop() {
	patcher.unpatchAll();
	stopSaving();
	closeHistorySheet();
	clearLog();
}
