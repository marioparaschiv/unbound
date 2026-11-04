import { PRIVATE_CHANNEL_ACTIONS_FILTER } from '~/modules';
import type { Session } from '~/session';
import { markOnCall } from '~/patches/mark-on-call';

/**
 * @description Remembers group chats the user leaves, so their removal is not reported.
 * @param session The running session.
 * @returns A function that removes the patch.
 */
export function patchPrivateChannelActions(session: Session): () => void {
	return markOnCall(
		PRIVATE_CHANNEL_ACTIONS_FILTER,
		['closePrivateChannel'],
		session.manual.groups,
	);
}
