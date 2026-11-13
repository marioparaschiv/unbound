import { storage } from '@unbound-app/api';

import type { SeenSessions, Session } from '~/lib/sessions';

const NAMES = 'names';
const SEEN = 'seen';

/**
 * @description Reads the name the user gave each session.
 * @returns The names by session hash.
 */
export function sessionNames(): Record<string, string> {
	return storage.getBucket().get(NAMES, {}) as Record<string, string>;
}

/**
 * @description Names a session, or clears its name when `name` is empty.
 * @param hash The session's hash.
 * @param name The name.
 */
export function nameSession(hash: string, name: string): void {
	const { [hash]: _previous, ...rest } = sessionNames();

	storage.getBucket().set(NAMES, name.trim() ? { ...rest, [hash]: name.trim() } : rest);
}

/**
 * @description Reads when the plugin first saw each session.
 * @returns The first-seen times by session hash.
 */
export function seenSessions(): SeenSessions {
	return storage.getBucket().get(SEEN, {}) as SeenSessions;
}

/**
 * @description Records the sessions the plugin has not seen before as seen now, or as long known on its first run.
 * @param sessions The sessions to record.
 * @param now The current time.
 */
export function rememberSessions(sessions: Session[], now: number = Date.now()): void {
	const seen = seenSessions();
	const added = sessions.filter((session) => seen[session.id_hash] === undefined);
	const firstSeen = Object.keys(seen).length ? now : 0;

	if (!added.length) return;

	storage.getBucket().set(SEEN, {
		...seen,
		...Object.fromEntries(added.map((session) => [session.id_hash, firstSeen])),
	});
}
