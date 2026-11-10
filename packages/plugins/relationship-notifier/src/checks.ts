import { settings } from '@unbound-app/settings';

import {
	currentUserId,
	isGuildUnavailable,
	readSnapshot,
	relationshipType,
	resolveUser,
	type DiscordUser,
} from '~/discord';
import { notify, notifyAboutUser } from '~/notify';
import { findOfflineRemovals, keepUnconfirmedGuilds, type OfflineRemovals } from '~/removals';
import { messages, uniqueUsername } from '~/messages';
import { loadSnapshot } from '~/snapshot-file';
import { flushSave, scheduleSave, type Session } from '~/session';

async function notifyUsers(ids: string[], text: (name: string) => string): Promise<void> {
	for (const id of ids) {
		const user: DiscordUser | undefined = await resolveUser(id);

		if (user) notifyAboutUser(text(uniqueUsername(user)), user);
	}
}

async function report(removals: OfflineRemovals): Promise<void> {
	for (const group of removals.groups) notify(messages.offlineGroup(group.name), group.iconURL);
	for (const guild of removals.guilds) notify(messages.offlineServer(guild.name), guild.iconURL);

	await notifyUsers(removals.friends, messages.offlineFriend);
	await notifyUsers(removals.requests, messages.offlineRequest);
}

async function check(session: Session): Promise<void> {
	const userId = currentUserId();

	if (!userId) return;

	const sameUser = session.checked && session.userId === userId;

	if (!sameUser) await flushSave(session);

	const previous = sameUser ? session.snapshot : await loadSnapshot(userId);

	if (!session.active || currentUserId() !== userId) return;

	const current = readSnapshot(userId);

	session.userId = userId;
	session.snapshot = previous
		? keepUnconfirmedGuilds(previous, current, isGuildUnavailable)
		: current;
	session.checked = true;
	scheduleSave(session);

	if (!previous || !session.active) return;

	await report(
		findOfflineRemovals(previous, current, {
			settings,
			isGuildUnavailable,
			relationshipType,
		}),
	);
}

/**
 * @description Takes a fresh snapshot and reports what was lost since the last one, as Vencord does on start and on each gateway connection.
 * @param session The running session.
 * @returns A promise that settles once the check and its notifications are done; a check already running is reused.
 */
export function syncAndRunChecks(session: Session): Promise<void> {
	session.checking ??= check(session)
		.catch((error: unknown) => {
			logger.error('The offline check failed:', error);
		})
		.finally(() => {
			session.checking = undefined;
		});

	return session.checking;
}
