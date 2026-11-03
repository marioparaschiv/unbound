import { PLATFORM_LABELS, PLATFORM_GLYPHS, type Platform } from '~/constants';

export type ClientStatusMap = Partial<Record<string, string>>;

export type Session = {
	status?: string;
	clientInfo?: { client?: string };
};

export type PlatformStatus = {
	platform: string;
	status: string;
};

const STATUS_RANK: Record<string, number> = { online: 2, idle: 1 };

function rank(status: string | undefined): number {
	return STATUS_RANK[status ?? ''] ?? 0;
}

/**
 * @description Names a platform the way Vencord's tooltips do.
 * @param platform A client status key, such as `desktop` or `embedded`.
 * @returns The platform's label, such as `Desktop` or `Embedded (Console or Game)`.
 */
export function platformLabel(platform: string): string {
	return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

/**
 * @description Builds the signed-in user's client status from their sessions, since Discord sends no presence for the current user.
 * @param sessions The sessions from Discord's `SessionsStore`, keyed by session ID.
 * @returns Each client's most present status, or `null` when the sessions are unreadable.
 */
export function ownClientStatus(sessions: unknown): ClientStatusMap | null {
	if (typeof sessions !== 'object' || sessions === null) return null;

	const sorted = [...(Object.values(sessions) as Session[])].sort(
		(a, b) => rank(a?.status) - rank(b?.status),
	);
	const statuses: ClientStatusMap = {};

	for (const session of sorted) {
		const client = session?.clientInfo?.client;

		if (client && client !== 'unknown' && session.status) statuses[client] = session.status;
	}

	return statuses;
}

/**
 * @description Lists the platforms in a client status map that have a status.
 * @param statusMap A user's client status, such as `{ desktop: 'online', mobile: 'idle' }`.
 * @returns One entry per platform, in the map's order.
 */
export function platformStatuses(statusMap: ClientStatusMap | null | undefined): PlatformStatus[] {
	if (!statusMap) return [];

	return Object.entries(statusMap).flatMap(([platform, status]) =>
		typeof status === 'string' && status ? [{ platform, status }] : [],
	);
}

/**
 * @description Encodes a user's platforms as one string, so a store hook can compare them by value.
 * @param statuses The user's platforms.
 * @returns A key such as `desktop:online,mobile:idle`.
 */
export function statusesKey(statuses: PlatformStatus[]): string {
	return statuses.map(({ platform, status }) => `${platform}:${status}`).join(',');
}

/**
 * @description Decodes a key made by {@link statusesKey}.
 * @param key The encoded platforms.
 * @returns One entry per platform, in the key's order.
 */
export function parseStatusesKey(key: string): PlatformStatus[] {
	if (!key) return [];

	return key.split(',').flatMap((entry) => {
		const [platform, status] = entry.split(':');

		return platform && status ? [{ platform, status }] : [];
	});
}

/**
 * @description Decides whether Discord should show the mobile status shape whatever the user's status is, as Vencord's Color Mobile Indicator does.
 * @param statusMap The user's client status.
 * @returns `true` when the user is on mobile and not online on desktop.
 */
export function isMobileShown(statusMap: ClientStatusMap | null | undefined): boolean {
	return statusMap?.mobile != null && statusMap.desktop !== 'online';
}

/**
 * @description Reads the symbol a message header shows for a platform.
 * @param platform A client status key.
 * @returns The platform's symbol, the desktop one for a platform Vencord has no icon for.
 */
export function platformGlyph(platform: string): string {
	return PLATFORM_GLYPHS[platform as Platform] ?? PLATFORM_GLYPHS.desktop;
}

/**
 * @description Describes where a user is online for screen readers.
 * @param statuses The user's platforms.
 * @returns Text such as `Online on Desktop and Mobile`, or an empty string for no platforms.
 */
export function describePlatforms(statuses: PlatformStatus[]): string {
	if (!statuses.length) return '';

	const list = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
		statuses.map(({ platform }) => platformLabel(platform)),
	);

	return `Online on ${list}`;
}
