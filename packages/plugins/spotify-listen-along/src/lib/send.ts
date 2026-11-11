import { flux, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import type { SpotifyActivity } from '~/lib/types';
import { ACTIVITY_ACTION_LISTEN, DRAFT_TYPE_CHANNEL_MESSAGE } from '~/lib/constants';

const SpotifyStore = flux.getStore('Spotify');
const SelectedChannelStore = flux.getStore('SelectedChannel');
const DraftStore = flux.getStore('Draft');

/** Discord's message and draft actions the invite sends and clears the draft with. */
export type InviteActions = {
	MessageActions: {
		sendMessage: (
			channelId: string,
			message: {
				content: string;
				tts: boolean;
				invalidEmojis: [];
				validNonShortcutEmojis: [];
			},
			waitForChannel: boolean,
			options: { activityAction: { activity: SpotifyActivity; type: number } },
		) => unknown;
	};
	DraftActions: { clearDraft: (channelId: string, draftType: number) => unknown };
};

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
 * @param actions Discord's message and draft actions.
 */
export function sendListenAlongInvite({ MessageActions, DraftActions }: InviteActions): void {
	const activity = currentListenableActivity();
	const channelId = SelectedChannelStore.getChannelId?.();

	if (!activity || !channelId) {
		toasts.show({ title: addon.name, content: messages.PLAY_SOMETHING });

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
