import type { FluxActionOf } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

import { resolveUser } from '~/discord';
import { messages, uniqueUsername } from '~/messages';
import { readSettings } from '~/modules';
import { notifyAboutUser } from '~/notify';
import { relationshipRemovalKind } from '~/removals';
import { refresh, type Session } from '~/session';

async function report(id: string, kind: 'friend' | 'request', session: Session) {
	const user = await resolveUser(id);

	if (!user || !session.active) return;

	const name = uniqueUsername(user);

	notifyAboutUser(
		kind === 'friend' ? messages.removedFriend(name) : messages.removedRequest(name),
		user,
	);
}

/**
 * @description Reports a friend removing the user or an incoming friend request being withdrawn, unless the user did it.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */
export function subscribeRelationshipRemove(session: Session): () => void {
	function onRelationshipRemove({ relationship }: FluxActionOf<'RELATIONSHIP_REMOVE'>) {
		const id = relationship?.id;

		refresh(session, 'relationships');

		if (!id || session.manual.friends.consume(id)) return;

		const kind = relationshipRemovalKind(relationship.type ?? 0, readSettings());

		if (kind) void report(id, kind, session);
	}

	return flux.onAction('RELATIONSHIP_REMOVE', onRelationshipRemove);
}
