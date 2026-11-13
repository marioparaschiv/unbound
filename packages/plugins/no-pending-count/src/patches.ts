import { flux, metro, patcher } from '@unbound-app/api';
import type { FluxStore } from '@unbound-app/api/flux';
import { settings } from '@unbound-app/settings';

import '~/lib/types';

type PendingCountStore = FluxStore & { getPendingCount: () => number };

function hasPendingCount(store: FluxStore | undefined): store is PendingCountStore {
	return typeof (store as Partial<PendingCountStore> | undefined)?.getPendingCount === 'function';
}

const none = () => 0;

/**
 * @description Reports no incoming friend requests to every count Discord shows.
 * Patches `getPendingCount` on the Relationship store and the incoming count helpers in `useFriendRequestCounts`.
 */
export function patchFriendRequestCount(): void {
	if (!settings.friendRequests) return;

	const RelationshipStore = flux.getStore('Relationship');
	const Counts = metro.findByFilePath('modules/people/hooks/useFriendRequestCounts.tsx');

	if (!hasPendingCount(RelationshipStore) || !Counts) {
		logger.warn(
			'Friend request count skipped: Discord moved RelationshipStore or useFriendRequestCounts.',
		);

		return;
	}

	patcher.instead(RelationshipStore, 'getPendingCount', none);

	for (const name of ['getIncomingFriendRequestCount', 'useIncomingFriendRequestCount']) {
		if (typeof Counts[name] === 'function') patcher.instead(Counts, name, none);
	}
}

/**
 * @description Reports no message or spam requests to every count Discord shows.
 * Patches `getMessageRequestsCount` on the MessageRequest store, `getSpamChannelsCount` on the SpamMessageRequest store
 * and `useMessageRequestsCount`.
 */
export function patchMessageRequestCount(): void {
	if (!settings.messageRequests) return;

	const MessageRequestStore = flux.getStore('MessageRequest');
	const SpamStore = flux.getStore('SpamMessageRequest');
	const Hook = metro.findByFilePath('modules/message_request/hooks/useMessageRequestsCount.tsx');

	if (typeof MessageRequestStore?.getMessageRequestsCount !== 'function') {
		logger.warn('Message request count skipped: Discord moved MessageRequestStore.');

		return;
	}

	patcher.instead(MessageRequestStore, 'getMessageRequestsCount', none);

	if (typeof SpamStore?.getSpamChannelsCount === 'function') {
		patcher.instead(SpamStore, 'getSpamChannelsCount', none);
	}

	if (typeof Hook?.useMessageRequestsCount === 'function') {
		patcher.instead(Hook, 'useMessageRequestsCount', none);
	}
}
