const NEW_FOR_MS = 24 * 60 * 60 * 1000;

export type Session = {
	id_hash: string;
	approx_last_used_time: string;
	client_info: { os: string; platform: string; location: string };
};

export type SeenSessions = Record<string, number>;

/**
 * @description Names a session the way Discord does when it has no name of its own.
 * @param session The session.
 * @returns Its operating system and client, such as `iOS · Discord iOS`.
 */
export function defaultName({ client_info }: Session): string {
	return `${client_info.os} · ${client_info.platform}`;
}

/**
 * @description Writes when a session was last used, to the minute.
 * @param session The session.
 * @param locale The language to write it in.
 * @param timeZone The time zone, the device's own by default.
 * @returns The time, such as `13 Nov 2026, 03:05`, or an empty string when Discord sent none.
 */
export function lastUsed(session: Session, locale?: string, timeZone?: string): string {
	const time = new Date(session.approx_last_used_time);

	if (Number.isNaN(time.getTime())) return '';

	return time.toLocaleString(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone,
	});
}

/**
 * @description Whether a session showed up within the last day.
 * @param firstSeen When the plugin first saw it, or `undefined` if it never has.
 * @param now The current time.
 * @returns Whether to mark it as new.
 */
export function isNew(firstSeen: number | undefined, now: number): boolean {
	return firstSeen === undefined || now - firstSeen < NEW_FOR_MS;
}

/**
 * @description Picks the sessions the plugin has not seen before.
 * @param sessions The account's sessions.
 * @param seen When each known session was first seen.
 * @returns The sessions it has not seen.
 */
export function unseenSessions(sessions: Session[], seen: SeenSessions): Session[] {
	return sessions.filter((session) => seen[session.id_hash] === undefined);
}
