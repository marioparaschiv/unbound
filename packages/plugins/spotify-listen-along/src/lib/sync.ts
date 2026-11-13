import { flux, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';

import type { SpotifyActivity } from '~/lib/types';
import { LOADING_MS } from '~/lib/constants';
import { toggleListening } from '~/lib/session';

const SpotifyStore = flux.getStore('Spotify');
const UserStore = flux.getStore('User');

export type DisabledReason = 'YOURSELF' | 'NOT_DETECTED';

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

	if (!SpotifyStore.hasConnectedAccount()) return 'NOT_DETECTED';

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
		[SpotifyStore, UserStore],
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
	return reason === 'NOT_DETECTED' ? messages.NOT_DETECTED : messages.YOURSELF;
}

/**
 * @description Starts listening along with an activity's user, following their track, position and pauses, or stops when you already are.
 * @param state The activity's listen state.
 * @param activity The Spotify activity.
 * @returns Whether listening along started.
 */
export function listenAlong(state: ListenState, activity: SpotifyActivity): boolean {
	if (state.disabledReason || !state.userId) {
		toasts.show({ title: addon.name, content: reasonText(state.disabledReason) });

		return false;
	}

	return toggleListening(state.userId, activity);
}
