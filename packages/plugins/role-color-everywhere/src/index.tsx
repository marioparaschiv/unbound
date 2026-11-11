import { patcher } from '@unbound-app/api';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMessageReactions, plainMessageReactions } from '~/patches/message-reactions';
import { patchTypingIndicator, plainTypingIndicator } from '~/patches/typing-indicator';
import { patchUsersFastList, plainUsersFastList } from '~/patches/users-fast-list';
import { colorNativeMentions, restoreNativeMentions } from '~/native/mentions';
import { patchVoiceUserNameItem } from '~/patches/voice-user-name-item';
import { patchPollVotes, plainPollVotes } from '~/patches/poll-votes';
import { patchRowManager } from '~/patches/row-manager';

export function start(context: PluginContext) {
	patchRowManager();
	colorNativeMentions(context);
	patchTypingIndicator();
	patchUsersFastList();
	patchMessageReactions();
	patchPollVotes();
	patchVoiceUserNameItem();
}

export async function stop() {
	patcher.unpatchAll();
	plainTypingIndicator();
	plainUsersFastList();
	plainMessageReactions();
	plainPollVotes();
	await restoreNativeMentions();
}
