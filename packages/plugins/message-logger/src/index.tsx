import { chatRowsSelfTest, trackChatRows } from '@unbound-plugins/shared/lifecycle/chat-rows';
import { patcher } from '@unbound-app/api';

import {
	interceptDeletions,
	interceptEdits,
	trackNonces,
	trackOwnDeletions,
} from '~/flux/interceptors';
import { ownDeletions } from '~/lib/own-deletions';
import { patchMessageActions } from '~/patches/message-actions';
import { patchMessageRows } from '~/patches/message-rows';
import { startSaving, stopSaving } from '~/lib/persist';
import { startSavingDeletedChannels, stopSavingDeletedChannels } from '~/lib/save-deleted-channels';
import { trackChannelDeletions } from '~/flux/channel-deletions';
import { clearDeletedChannels } from '~/lib/deleted-channels';
import { closeHistorySheet } from '~/lib/sheet';
import { clearLog } from '~/lib/clear';
import SettingsPanel from '~/settings';

export function start() {
	ownDeletions.clear();
	interceptDeletions();
	interceptEdits();
	trackNonces();
	trackOwnDeletions();
	patchMessageRows();
	patchMessageActions();
	startSaving();
	trackChatRows();
	trackChannelDeletions();
	startSavingDeletedChannels();
}

// Saving stops before the log clears, so the saved file keeps it. The row patches go first, so the cleared rows draw plain;
// the interceptors stay on for `clearLog` until the Addon scope removes them.
export function stop() {
	patcher.unpatchAll();
	stopSaving();
	stopSavingDeletedChannels();
	closeHistorySheet();
	clearLog();
	clearDeletedChannels();
	ownDeletions.clear();
}

export function selfTest() {
	return chatRowsSelfTest();
}

export { SettingsPanel };
