import type { FluxActionOf } from '@unbound-app/api/flux';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { getSession, refresh, type Session } from '~/lib/session';
import { isGuildUnavailable, resolveUser, type SnapshotPart } from '~/lib/discord';
import { messages, uniqueUsername } from '~/lib/messages';
import { relationshipRemovalKind } from '~/lib/removals';
import { notify, notifyAboutUser } from '~/lib/notify';
import { GROUP_DM_CHANNEL_TYPE } from '~/lib/constants';
import { syncAndRunChecks } from '~/lib/checks';

const SNAPSHOT_ACTIONS: Record<string, SnapshotPart> = {
	GUILD_CREATE: 'guilds',
	CHANNEL_CREATE: 'groups',
	RELATIONSHIP_ADD: 'relationships',
	RELATIONSHIP_UPDATE: 'relationships',
};

async function reportUser(id: string, kind: 'friend' | 'request', session: Session) {
	const user = await resolveUser(id);

	if (!user || !session.active) return;

	const name = uniqueUsername(user);

	notifyAboutUser(
		kind === 'friend' ? messages.removedFriend(name) : messages.removedRequest(name),
		user,
	);
}

/**
 * @description Keeps the snapshot current as the user joins servers and group chats and gains friends or requests.
 */
export function listenToSnapshotChanges(): void {
	const session = getSession();

	for (const [type, part] of Object.entries(SNAPSHOT_ACTIONS)) {
		flux.onAction(type, () => refresh(session, part));
	}
}

/**
 * @description Reports being removed from a server, unless the user left it or it is in an outage.
 */
export function listenToGuildDelete(): void {
	const session = getSession();

	flux.onAction('GUILD_DELETE', ({ guild }: FluxActionOf<'GUILD_DELETE'>) => {
		const id = guild?.id;

		if (!id || guild.unavailable || isGuildUnavailable(id) === true) return;

		const known = session.snapshot.guilds.find((entry) => entry.id === id);
		const manual = session.manual.guilds.consume(id);

		refresh(session, 'guilds', id);

		if (known && !manual && settings.servers) {
			notify(messages.removedFromServer(known.name), known.iconURL);
		}
	});
}

/**
 * @description Reports being removed from a group chat, unless the user left it.
 */
export function listenToChannelDelete(): void {
	const session = getSession();

	flux.onAction('CHANNEL_DELETE', ({ channel }: FluxActionOf<'CHANNEL_DELETE'>) => {
		const id = channel?.id;

		if (!id || channel.type !== GROUP_DM_CHANNEL_TYPE) return;

		const known = session.snapshot.groups.find((entry) => entry.id === id);
		const manual = session.manual.groups.consume(id);

		refresh(session, 'groups');

		if (known && !manual && settings.groups) {
			notify(messages.removedFromGroup(known.name), known.iconURL);
		}
	});
}

/**
 * @description Reports a friend removing the user or an incoming friend request being withdrawn, unless the user did it.
 */
export function listenToRelationshipRemove(): void {
	const session = getSession();

	flux.onAction(
		'RELATIONSHIP_REMOVE',
		({ relationship }: FluxActionOf<'RELATIONSHIP_REMOVE'>) => {
			const id = relationship?.id;

			refresh(session, 'relationships');

			if (!id || session.manual.friends.consume(id)) return;

			const kind = relationshipRemovalKind(relationship.type ?? 0, settings);

			if (kind) void reportUser(id, kind, session);
		},
	);
}

/**
 * @description Reports removals that happened while the gateway was disconnected, each time it connects.
 */
export function listenToConnectionOpen(): void {
	const session = getSession();

	flux.onAction('CONNECTION_OPEN', () => void syncAndRunChecks(session));
}
