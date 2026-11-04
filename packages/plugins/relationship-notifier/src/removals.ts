import { RelationshipType, type Settings } from '~/constants';
import type { SimpleEntry, Snapshot } from '~/snapshot';

export type OfflineRemovals = {
	groups: SimpleEntry[];
	guilds: SimpleEntry[];
	friends: string[];
	requests: string[];
};

export type RemovalContext = {
	settings: Settings;
	isGuildUnavailable: (id: string) => boolean | undefined;
	relationshipType: (id: string) => number;
};

const SETTLED_REQUEST_TYPES: readonly number[] = [
	RelationshipType.FRIEND,
	RelationshipType.BLOCKED,
	RelationshipType.OUTGOING_REQUEST,
];

function missingEntries(previous: SimpleEntry[], current: SimpleEntry[]): SimpleEntry[] {
	const present = new Set(current.map((entry) => entry.id));

	return previous.filter((entry) => !present.has(entry.id));
}

function missingIds(previous: string[], current: string[]): string[] {
	const present = new Set(current);

	return previous.filter((id) => !present.has(id));
}

/**
 * @description Finds what the user lost while Discord was closed or disconnected, as Vencord's offline check does.
 * @param previous The snapshot saved before.
 * @param current The snapshot of Discord's state now.
 * @param context The settings and the live lookups the check needs.
 * @returns The groups, guilds, friends and incoming requests that are gone, each empty when its setting is off.
 */
export function findOfflineRemovals(
	previous: Snapshot,
	current: Snapshot,
	{ settings, isGuildUnavailable, relationshipType }: RemovalContext,
): OfflineRemovals {
	const none: OfflineRemovals = { groups: [], guilds: [], friends: [], requests: [] };

	if (!settings.offlineRemovals) return none;

	return {
		groups: settings.groups ? missingEntries(previous.groups, current.groups) : [],
		guilds: settings.servers
			? missingEntries(previous.guilds, current.guilds).filter(
					(guild) => isGuildUnavailable(guild.id) === false,
				)
			: [],
		friends: settings.friends ? missingIds(previous.friends, current.friends) : [],
		requests: settings.friendRequestCancels
			? missingIds(previous.requests, current.requests).filter(
					(id) => !SETTLED_REQUEST_TYPES.includes(relationshipType(id)),
				)
			: [],
	};
}

/**
 * @description Keeps guilds that are missing only because of an outage, or because this build cannot tell, in the snapshot to save, so a later check can still report them.
 * @param previous The snapshot saved before.
 * @param current The snapshot of Discord's state now.
 * @param isGuildUnavailable Whether a guild is in an outage, `undefined` when unknown.
 * @returns The current snapshot with those guilds added back.
 */
export function keepUnconfirmedGuilds(
	previous: Snapshot,
	current: Snapshot,
	isGuildUnavailable: (id: string) => boolean | undefined,
): Snapshot {
	const kept = missingEntries(previous.guilds, current.guilds).filter(
		(guild) => isGuildUnavailable(guild.id) !== false,
	);

	return kept.length ? { ...current, guilds: [...current.guilds, ...kept] } : current;
}

/**
 * @description Decides which setting a live `RELATIONSHIP_REMOVE` falls under.
 * @param type The type the relationship had before it was removed.
 * @param settings The plugin's settings.
 * @returns `'friend'` or `'request'` when the user should be notified, else `undefined`.
 */
export function relationshipRemovalKind(
	type: number,
	settings: Settings,
): 'friend' | 'request' | undefined {
	if (type === RelationshipType.FRIEND && settings.friends) return 'friend';
	if (type === RelationshipType.INCOMING_REQUEST && settings.friendRequestCancels)
		return 'request';

	return undefined;
}

export type ManualRemovals = {
	mark: (id: string) => void;
	consume: (id: string) => boolean;
	clear: () => void;
};

/**
 * @description Remembers removals the user made themselves, so the removal that follows is not reported.
 * @returns A tracker whose `consume` reports and forgets one marked id.
 */
export function createManualRemovals(): ManualRemovals {
	const marked = new Set<string>();

	return {
		mark: (id) => void marked.add(id),
		consume: (id) => marked.delete(id),
		clear: () => marked.clear(),
	};
}
