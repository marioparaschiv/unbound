import { SAVE_DELAY } from '~/constants';
import { currentUserId, isGuildUnavailable, readPart, type SnapshotPart } from '~/discord';
import { createManualRemovals, keepUnconfirmedGuilds, type ManualRemovals } from '~/removals';
import { saveSnapshot } from '~/snapshot-file';
import { emptySnapshot, type Snapshot } from '~/snapshot';

export type Session = {
	active: boolean;
	userId?: string;
	snapshot: Snapshot;
	checked: boolean;
	checking?: Promise<void>;
	saveTimer?: ReturnType<typeof setTimeout>;
	manual: Record<'friends' | 'guilds' | 'groups', ManualRemovals>;
};

/**
 * @description Creates the state the plugin keeps while it runs.
 * @returns A session with no user and nothing checked yet.
 */
export function createSession(): Session {
	return {
		active: true,
		snapshot: emptySnapshot(),
		checked: false,
		manual: {
			friends: createManualRemovals(),
			guilds: createManualRemovals(),
			groups: createManualRemovals(),
		},
	};
}

/**
 * @description Saves the session's snapshot now, cancelling a pending save.
 * @param session The running session.
 * @returns A promise that settles once the snapshot is written.
 */
export function flushSave(session: Session): Promise<void> {
	if (session.saveTimer === undefined) return Promise.resolve();

	clearTimeout(session.saveTimer);
	session.saveTimer = undefined;

	return session.userId ? saveSnapshot(session.userId, session.snapshot) : Promise.resolve();
}

/**
 * @description Saves the session's snapshot shortly, so a burst of events writes it once.
 * @param session The running session.
 */
export function scheduleSave(session: Session): void {
	if (!session.active) return;
	if (session.saveTimer !== undefined) clearTimeout(session.saveTimer);

	session.saveTimer = setTimeout(() => void flushSave(session), SAVE_DELAY);
}

/**
 * @description Rereads one part of the snapshot after Discord changed it, once the first check has run for the signed-in user.
 * Servers missing for an outage, or whose availability is unknown, stay in the snapshot unless the event confirmed that server gone.
 * @param session The running session.
 * @param part The part an event changed.
 * @param goneGuildId The server a `GUILD_DELETE` confirmed gone.
 */
export function refresh(session: Session, part: SnapshotPart, goneGuildId?: string): void {
	const userId = currentUserId();

	if (!session.active || !session.checked || !userId || userId !== session.userId) return;

	const next = { ...session.snapshot, ...readPart(part, userId) };

	session.snapshot =
		part === 'guilds'
			? keepUnconfirmedGuilds(session.snapshot, next, (id) =>
					id === goneGuildId ? false : isGuildUnavailable(id),
				)
			: next;
	scheduleSave(session);
}

/**
 * @description Stops the session: writes a pending save and forgets manual removals.
 * @param session The running session.
 * @returns A promise that settles once the snapshot is written.
 */
export function closeSession(session: Session): Promise<void> {
	session.active = false;

	for (const removals of Object.values(session.manual)) removals.clear();

	return flushSave(session);
}
