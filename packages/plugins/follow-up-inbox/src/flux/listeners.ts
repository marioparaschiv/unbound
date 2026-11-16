import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { isFollowedUp, removeFollowUp } from '~/lib/follow-ups';
import { getFollowUps, saveFollowUps } from '~/lib/store';

type CreatedMessage = {
	author?: { id?: string };
	message_reference?: { message_id?: string } | null;
};

type UserStore = { getCurrentUser(): { id: string } | undefined };

/**
 * @description Clears a follow-up when you reply to its message, while Done When You Reply is on.
 */
export function listenToReplies(): void {
	flux.onAction(
		'MESSAGE_CREATE',
		({ message, optimistic }: { message?: CreatedMessage; optimistic?: boolean }) => {
			if (!settings.doneOnReply || optimistic) return;

			const referenced = message?.message_reference?.message_id;
			const me = (flux.getStore('User') as unknown as UserStore).getCurrentUser()?.id;

			if (!referenced || !me || message?.author?.id !== me) return;

			const list = getFollowUps();

			if (isFollowedUp(list, referenced)) saveFollowUps(removeFollowUp(list, referenced));
		},
	);
}

export default { listenToReplies };
