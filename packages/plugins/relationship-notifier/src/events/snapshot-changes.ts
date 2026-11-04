import { flux } from '@unbound-app/api';

import type { SnapshotPart } from '~/discord';
import { refresh, type Session } from '~/session';

const ACTIONS: Record<string, SnapshotPart> = {
	GUILD_CREATE: 'guilds',
	CHANNEL_CREATE: 'groups',
	RELATIONSHIP_ADD: 'relationships',
	RELATIONSHIP_UPDATE: 'relationships',
};

/**
 * @description Keeps the snapshot current as the user joins servers and group chats and gains friends or requests.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */
export function subscribeSnapshotChanges(session: Session): () => void {
	const unsubscribes = Object.entries(ACTIONS).map(([type, part]) =>
		flux.onAction(type, () => refresh(session, part)),
	);

	return () => {
		for (const unsubscribe of unsubscribes) unsubscribe();
	};
}
