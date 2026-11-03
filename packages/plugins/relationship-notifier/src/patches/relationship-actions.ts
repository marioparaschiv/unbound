import { RELATIONSHIP_ACTIONS_FILTER } from '~/modules';
import type { Session } from '~/session';
import { markOnCall } from '~/patches/mark-on-call';

/**
 * @description Remembers friends and friend requests the user removes, so their removal is not reported.
 * @param session The running session.
 * @returns A function that removes the patches.
 */
export function patchRelationshipActions(session: Session): () => void {
	return markOnCall(
		RELATIONSHIP_ACTIONS_FILTER,
		['removeRelationship', 'removeFriend', 'cancelFriendRequest', 'rejectFriendRequest'],
		session.manual.friends,
	);
}
