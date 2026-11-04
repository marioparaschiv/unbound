import { flux, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';

import { SpotifyActions, SpotifyProtocolStore, SpotifyStore, UserStore } from '~/listen/modules';
import type { SpotifyActivity } from '~/types';
import { LOADING_MS, PLUGIN_NAME } from '~/constants';

export type DisabledReason = 'YOURSELF' | 'ALREADY_LISTENING' | 'NOT_DETECTED';

export type ListenState = {
	disabledReason: DisabledReason | null;
	userId: string | undefined;
};

/**
 * @description Reads the user a Spotify activity belongs to from its party id, which Discord writes as `spotify:<user id>`.
 * @param activity The Spotify activity.
 * @returns The user's id, or `undefined` for an activity without a party.
 */
export function partyUserId(activity: SpotifyActivity): string | undefined {
	return activity.party?.id?.split(':')[1];
}

function disabledReason(
	activity: SpotifyActivity,
	userId: string | undefined,
): DisabledReason | null {
	if (!userId || userId === UserStore.getCurrentUser?.()?.id) return 'YOURSELF';

	const listening = SpotifyStore.getActivity();

	if (listening?.party?.id && listening.party.id === activity.party?.id) {
		return 'ALREADY_LISTENING';
	}

	const canPlay =
		Boolean(SpotifyStore.getActiveSocketAndDevice()) ||
		Boolean(SpotifyProtocolStore.isProtocolRegistered());

	if (!SpotifyStore.hasConnectedAccount() || !canPlay) return 'NOT_DETECTED';

	return null;
}

/**
 * @description Tracks whether you can listen along to an activity, re-rendering as Spotify's state changes.
 * @param activity The Spotify activity.
 * @returns Why listening along is unavailable, or `null`, and the activity's user.
 */
export function useListenState(activity: SpotifyActivity): ListenState {
	const userId = partyUserId(activity);
	const reason = flux.useStore(
		[SpotifyStore, SpotifyProtocolStore, UserStore],
		() => disabledReason(activity, userId),
		{ deps: [activity, userId] },
	);

	return { disabledReason: reason, userId };
}

/**
 * @description Shows a spinner for a few seconds after a press, while Spotify starts playing.
 * @returns Whether it is loading, and a function that starts the spinner.
 */
export function useLoading(): { loading: boolean; start: () => void } {
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!loading) return;

		const timer = setTimeout(() => setLoading(false), LOADING_MS);

		return () => clearTimeout(timer);
	}, [loading]);

	return { loading, start: () => setLoading(true) };
}

function reasonText(reason: DisabledReason | null): string {
	switch (reason) {
		case 'ALREADY_LISTENING':
			return messages.ALREADY_LISTENING;
		case 'NOT_DETECTED':
			return messages.NOT_DETECTED;
		default:
			return messages.YOURSELF;
	}
}

function syncOnNextPlayerState(activity: SpotifyActivity, userId: string) {
	const stop = flux.onAction('SPOTIFY_PLAYER_STATE', () => {
		stop();
		SpotifyActions.sync(activity, userId);
	});
}

/**
 * @description Starts listening along: syncs to the activity right away when Spotify is already playing, otherwise starts playback and syncs once Spotify reports its player state.
 * @param state The activity's listen state.
 * @param activity The Spotify activity.
 * @returns Whether listening along started.
 */
export function listenAlong(state: ListenState, activity: SpotifyActivity): boolean {
	if (state.disabledReason || !state.userId) {
		toasts.show({ title: PLUGIN_NAME, content: reasonText(state.disabledReason) });

		return false;
	}

	if (SpotifyStore.getActivity()) {
		SpotifyActions.sync(activity, state.userId);

		return true;
	}

	syncOnNextPlayerState(activity, state.userId);
	SpotifyActions.play(activity, state.userId);

	return true;
}
