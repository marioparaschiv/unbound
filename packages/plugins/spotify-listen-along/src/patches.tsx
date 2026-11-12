import { flux, metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import type { ReactElement } from 'react';

import { currentListenableActivity, sendListenAlongInvite, type InviteActions } from '~/lib/send';
import type { OverflowButton, SpotifyActivity } from '~/lib/types';
import { ListenAlongRow } from '~/components/listen-along-row';
import type { SpotifyActions } from '~/lib/sync';

type ButtonProps = { activity?: SpotifyActivity };

type ActionsProps = { overflowButtons?: OverflowButton[] };

const SpotifyStore = flux.getStore('Spotify');

function withListenAlong(
	actions: SpotifyActions,
	props: ButtonProps | undefined,
	result: ReactElement | null,
) {
	if (!result || !props?.activity?.party?.id) return result;

	return (
		<ListenAlongRow activity={props.activity} actions={actions}>
			{result}
		</ListenAlongRow>
	);
}

/**
 * @description Adds a Listen Along button next to Discord's Spotify buttons on activity cards, which syncs your Spotify to the track and position of the person you are looking at.
 * Patches `PlayOnSpotifyButton` (profile activity cards) and, when this build still has it, `SpotifyPlayButton` (older activity layouts) and wraps their result.
 * Depends on Discord's Spotify actions (`play`, `sync`) and `SpotifyStore`, `SpotifyProtocolStore` and `UserStore`.
 */
export function patchActivityButtons(): void {
	const SpotifyActions: SpotifyActions | undefined = metro.findByProps(
		'play',
		'sync',
		'getMetadata',
	);
	const ActivityButtons = metro.findByProps('PlayOnSpotifyButton');
	const SpotifyComponents = metro.findByProps('SpotifyPlayButton');

	if (!ActivityButtons || !SpotifyActions) {
		logger.warn(
			'Listen along skipped: Discord moved PlayOnSpotifyButton or the Spotify actions.',
		);

		return;
	}

	patcher.react.after(ActivityButtons, 'PlayOnSpotifyButton', ({ props, result }) =>
		withListenAlong(SpotifyActions, props as ButtonProps, result as ReactElement | null),
	);

	if (SpotifyComponents) {
		patcher.react.after(SpotifyComponents, 'SpotifyPlayButton', ({ props, result }) =>
			withListenAlong(SpotifyActions, props as ButtonProps, result as ReactElement | null),
		);
	}
}

/**
 * @description Adds a Spotify button to the bar at the bottom of the chat attachment menu, which invites the channel to listen along to what you are playing. It shows only when a Spotify account is connected, and is disabled while nothing plays.
 * Patches the render of the memoized `MediaKeyboardBottomSheetActions` and appends to its `overflowButtons` prop, next to Photos, Poll, Thread, Apps and Files.
 * Depends on `sendMessage`, `clearDraft`, `SpotifyStore`, `DraftStore` and `SelectedChannelStore`.
 */
export function patchMediaKeyboardActions(): void {
	const MediaKeyboardActions = metro.find(
		metro.filters.byTypeName('MediaKeyboardBottomSheetActions'),
	);
	const Icons = metro.findByProps('SpotifyNeutralIcon');
	const MessageActions: InviteActions['MessageActions'] | undefined = metro.api.Messages;
	const DraftActions: InviteActions['DraftActions'] | undefined = metro.findByProps('clearDraft');

	if (!MediaKeyboardActions || !Icons || !MessageActions || !DraftActions) {
		logger.warn(
			'Invite skipped: Discord moved MediaKeyboardBottomSheetActions, SpotifyNeutralIcon, Messages or clearDraft.',
		);

		return;
	}

	const actions = { MessageActions, DraftActions };

	patcher.react.before(MediaKeyboardActions, ({ props }: { props: ActionsProps }) => {
		if (!props.overflowButtons || !SpotifyStore.hasConnectedAccount()) return;

		const spotifyButton: OverflowButton = {
			text: messages.SPOTIFY,
			IconComponent: Icons.SpotifyNeutralIcon,
			onPress: () => sendListenAlongInvite(actions),
			disabled: !currentListenableActivity(),
		};

		return { ...props, overflowButtons: [...props.overflowButtons, spotifyButton] };
	});
}
