import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMessageReactionsContent } from '~/patches/message-reactions-content';
import { patchPollVotesActionSheet } from '~/patches/poll-votes-action-sheet';
import { patchVoiceUserNameItem } from '~/patches/voice-user-name-item';
import { patchTypingIndicator } from '~/patches/typing-indicator';
import { patchUsersFastList } from '~/patches/users-fast-list';
import SettingsPanel from '~/components/settings-panel';
import { createNativeMentions } from '~/native/mentions';
import { patchRowManager } from '~/patches/row-manager';
import { GuildMemberStore, settings } from '~/modules';
import { PLUGIN_NAME } from '~/constants';

let dispose = () => {};
let settled = () => Promise.resolve();

function start(context: PluginContext) {
	if (!ensureModules(PLUGIN_NAME, { GuildMemberStore })) return;

	const nativeMentions = createNativeMentions(context);

	settled = nativeMentions.settled;
	dispose = applyFeatures(PLUGIN_NAME, [
		patchRowManager,
		() => whileEnabled(settings, 'typingUsers', true, patchTypingIndicator),
		() => whileEnabled(settings, 'memberList', true, patchUsersFastList),
		() => whileEnabled(settings, 'reactorsList', true, patchMessageReactionsContent),
		() => whileEnabled(settings, 'pollResults', true, patchPollVotesActionSheet),
		() => whileEnabled(settings, 'voiceUsers', true, patchVoiceUserNameItem),
		() => whileEnabled(settings, 'chatMentions', true, nativeMentions.enable),
	]);
}

function stop() {
	dispose();
	dispose = () => {};

	return settled();
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
