import { toasts } from '@unbound-app/api';

import {
	DraftActions,
	DraftStore,
	MessageActions,
	SelectedChannelStore,
	SpotifyStore,
} from '~/discord/modules';
import type { SpotifyActivity } from '~/types';
import { ACTIVITY_ACTION_LISTEN, DRAFT_TYPE_CHANNEL_MESSAGE, PLUGIN_NAME } from '~/constants';

/**
 * @description Reads your current Spotify activity when it can be listened along to.
 * @returns The activity, or `undefined` while Spotify is not playing.
 */
export function currentListenableActivity(): SpotifyActivity | undefined {
	const activity = SpotifyStore.getActivity();

	return activity?.party?.id ? activity : undefined;
}

/**
 * @description Sends a listen-along invite for your Spotify activity to the selected channel, with your draft as the message text, and clears the draft.
 */
export function sendListenAlongInvite() {
	const activity = currentListenableActivity();
	const channelId = SelectedChannelStore.getChannelId?.();

	if (!activity || !channelId) {
		toasts.show({ title: PLUGIN_NAME, content: 'Play something on Spotify first.' });

		return;
	}

	MessageActions.sendMessage(
		channelId,
		{
			content: DraftStore.getDraft(channelId, DRAFT_TYPE_CHANNEL_MESSAGE) ?? '',
			tts: false,
			invalidEmojis: [],
			validNonShortcutEmojis: [],
		},
		true,
		{ activityAction: { activity, type: ACTIVITY_ACTION_LISTEN } },
	);
	DraftActions.clearDraft(channelId, DRAFT_TYPE_CHANNEL_MESSAGE);
}
