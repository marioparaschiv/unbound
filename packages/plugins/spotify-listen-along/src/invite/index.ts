import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import {
	DraftActions,
	Icons,
	MediaKeyboardActions,
	MessageActions,
	SpotifyStore,
} from '~/invite/modules';
import { currentListenableActivity, sendListenAlongInvite } from '~/invite/send';
import type { OverflowButton } from '~/types';
import { PLUGIN_NAME } from '~/constants';

type ActionsProps = { overflowButtons?: OverflowButton[] };

function spotifyButton(): OverflowButton {
	return {
		text: messages.SPOTIFY,
		IconComponent: Icons.SpotifyNeutralIcon,
		onPress: sendListenAlongInvite,
		disabled: !currentListenableActivity(),
	};
}

/**
 * @description Adds a Spotify button to the bar at the bottom of the chat attachment menu, which invites the channel to listen along to what you are playing. It shows only when a Spotify account is connected, and is disabled while nothing plays.
 * Patches the render of the memoized `MediaKeyboardBottomSheetActions` and appends to its `overflowButtons` prop, next to Photos, Poll, Thread, Apps and Files.
 * Depends on `sendMessage`, `clearDraft`, `SpotifyStore`, `DraftStore` and `SelectedChannelStore`.
 */
export function startListenAlongInvite(): void {
	if (
		!ensureModules(`${PLUGIN_NAME}: invite`, {
			MediaKeyboardActions,
			Icons,
			MessageActions,
			DraftActions,
		})
	) {
		return;
	}

	patcher.react.before(MediaKeyboardActions, ({ props }: { props: ActionsProps }) => {
		if (!props.overflowButtons || !SpotifyStore.hasConnectedAccount()) return;

		return { ...props, overflowButtons: [...props.overflowButtons, spotifyButton()] };
	});

	recordApplied(1);
}
