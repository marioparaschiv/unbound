import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import {
	DraftActions,
	Icons,
	MediaKeyboardActions,
	MessageActions,
	SpotifyStore,
} from '~/discord/modules';
import { currentListenableActivity, sendListenAlongInvite } from '~/invite/send';
import type { OverflowButton } from '~/types';
import { PLUGIN_NAME } from '~/constants';

type ActionsProps = { overflowButtons?: OverflowButton[] };

function spotifyButton(): OverflowButton {
	return {
		text: 'Spotify',
		IconComponent: Icons.SpotifyNeutralIcon,
		onPress: sendListenAlongInvite,
		disabled: !currentListenableActivity(),
	};
}

/**
 * @description Adds a Spotify button to the bar at the bottom of the chat attachment menu, which invites the channel to listen along to what you are playing. It shows only when a Spotify account is connected, and is disabled while nothing plays.
 * Patches the `type` of the memoized `MediaKeyboardBottomSheetActions` and appends to its `overflowButtons` prop, next to Photos, Poll, Thread, Apps and Files.
 * Depends on `sendMessage`, `clearDraft`, `SpotifyStore`, `DraftStore` and `SelectedChannelStore`.
 * @returns A function that removes the patch.
 */
export function startListenAlongInvite(): () => void {
	if (
		!ensureModules(`${PLUGIN_NAME}: invite`, {
			MediaKeyboardActions,
			Icons,
			MessageActions,
			DraftActions,
		})
	) {
		return () => undefined;
	}

	return patcher.before(MediaKeyboardActions, 'type', ({ args }) => {
		const props = args[0] as ActionsProps | undefined;

		if (!props?.overflowButtons || !SpotifyStore.hasConnectedAccount()) return;

		return [
			{ ...props, overflowButtons: [...props.overflowButtons, spotifyButton()] },
			...args.slice(1),
		];
	});
}
