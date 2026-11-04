import { flux } from '@unbound-app/api';
import { useMemo } from 'react';

import {
	ownClientStatus,
	parseStatusesKey,
	platformStatuses,
	statusesKey,
	type ClientStatusMap,
	type PlatformStatus,
} from '~/platforms';
import { PresenceStore, SessionsStore, UserStore } from '~/modules';

/**
 * @description Reads where a user is online: from their presence, or from the session list for the signed-in user.
 * @param userId The user to read.
 * @returns The user's client status, or `null` when Discord has none.
 */
export function getClientStatus(userId: string): ClientStatusMap | null {
	if (userId === UserStore.getCurrentUser()?.id) {
		return ownClientStatus(SessionsStore.getSessions?.());
	}

	return PresenceStore.getClientStatus(userId) ?? null;
}

/**
 * @description Lists a user's platforms.
 * @param userId The user to read.
 * @returns One entry per platform the user is on.
 */
export function getPlatformStatuses(userId: string): PlatformStatus[] {
	return platformStatuses(getClientStatus(userId));
}

/**
 * @description Tracks a user's platforms in a component, re-rendering when their presence or the signed-in user's sessions change.
 * @param userId The user to track.
 * @returns One entry per platform the user is on.
 */
export function usePlatformStatuses(userId: string): PlatformStatus[] {
	const key = flux.useStore(
		[PresenceStore, SessionsStore],
		() => statusesKey(getPlatformStatuses(userId)),
		[userId],
	);

	return useMemo(() => parseStatusesKey(key), [key]);
}
