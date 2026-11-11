import type { MetroFilter } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import { ownRemovalFromRequest, type RemovalMethod } from '~/lib/own-removal-routes';
import type { ManualRemovals } from '~/lib/removals';
import { getSession } from '~/lib/session';

type ActionCreators = Record<string, (...args: unknown[]) => unknown>;
type RestClient = Record<RemovalMethod, (request: unknown) => Promise<unknown>>;

const REST_METHODS: readonly RemovalMethod[] = ['del', 'post'];

// Marks the id an action creator is called with as a removal the user made, once its module loads.
function markOnCall(
	feature: string,
	filter: MetroFilter,
	methods: readonly string[],
	removals: ManualRemovals,
): void {
	metro.onModuleLoaded(
		filter,
		(module: ActionCreators) => {
			for (const method of methods) {
				if (typeof module[method] !== 'function') continue;

				patcher.before(module, method, ({ args: [id] }) => {
					if (typeof id === 'string') removals.mark(id);
				});
			}
		},
		{ onMissing: () => logger.warn(`${feature} skipped: Discord moved ${methods[0]}.`) },
	);
}

/**
 * @description Remembers friends and friend requests the user removes, so their removal is not reported.
 */
export function patchRelationshipActions(): void {
	markOnCall(
		'Own friend removals',
		metro.filters.byProps('removeRelationship'),
		['removeRelationship', 'removeFriend', 'cancelFriendRequest', 'rejectFriendRequest'],
		getSession().manual.friends,
	);
}

/**
 * @description Remembers servers the user leaves or deletes, so their removal is not reported.
 */
export function patchGuildActions(): void {
	markOnCall(
		'Own server removals',
		metro.filters.byProps('leaveGuild'),
		['leaveGuild', 'deleteGuild'],
		getSession().manual.guilds,
	);
}

/**
 * @description Remembers group chats the user leaves, so their removal is not reported.
 */
export function patchPrivateChannelActions(): void {
	markOnCall(
		'Own group removals',
		metro.filters.byProps('closePrivateChannel'),
		['closePrivateChannel'],
		getSession().manual.groups,
	);
}

/**
 * @description Marks removals the user makes from the API requests that make them, so every call path is covered,
 * including ones that skip the action creators' exports. Patches `del` and `post` of Discord's `REST`.
 */
export function patchRest(): void {
	const REST: RestClient | undefined = metro.common.REST;

	if (!REST) {
		logger.warn('Own removals by request skipped: Discord moved REST.');

		return;
	}

	const session = getSession();

	for (const method of REST_METHODS) {
		if (typeof REST[method] !== 'function') continue;

		patcher.before(REST, method, ({ args: [request] }) => {
			const removal = ownRemovalFromRequest(method, request);

			if (removal) session.manual[removal.kind].mark(removal.id);
		});
	}
}
