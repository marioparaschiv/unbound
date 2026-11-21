import { DELETED_CHANNEL_LIMIT } from '~/lib/constants';

/** A server channel deleted while Discord ran, as it was just before. */
export type DeletedChannel = {
	id: string;
	name: string;
	type: number;
	guildId: string;
	guildName: string;
	categoryName: string;
	topic: string;
	deletedAt: number;
};

type SavedChannels = { version: 1; channels: DeletedChannel[] };

const THREAD_TYPES = new Set([10, 11, 12]);

/**
 * @description Says whether a deleted channel was a thread, whose `categoryName` is then its parent channel.
 * @param channel The deleted channel.
 * @returns Whether it was a thread.
 */
export function isThread(channel: DeletedChannel): boolean {
	return THREAD_TYPES.has(channel.type);
}

const TEXT_FIELDS = ['id', 'name', 'guildId', 'guildName', 'categoryName', 'topic'] as const;

let channels: DeletedChannel[] = [];
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) listener();
}

function isDeletedChannel(value: unknown): value is DeletedChannel {
	if (!value || typeof value !== 'object') return false;

	const entry = value as Record<string, unknown>;

	return (
		TEXT_FIELDS.every((field) => typeof entry[field] === 'string') &&
		typeof entry.type === 'number' &&
		typeof entry.deletedAt === 'number'
	);
}

/**
 * @description Reads the deleted channels, newest first.
 * @returns The channels.
 */
export function deletedChannels(): DeletedChannel[] {
	return channels;
}

/**
 * @description Calls `listener` each time the deleted channels change.
 * @param listener The listener.
 * @returns A function that removes it.
 */
export function onDeletedChannelsChange(listener: () => void): () => void {
	listeners.add(listener);

	return () => void listeners.delete(listener);
}

/**
 * @description Adds a deleted channel at the top, dropping an older entry with its id and the oldest past the limit.
 * @param channel The channel.
 */
export function recordDeletedChannel(channel: DeletedChannel): void {
	channels = [channel, ...channels.filter((entry) => entry.id !== channel.id)].slice(
		0,
		DELETED_CHANNEL_LIMIT,
	);
	notify();
}

/**
 * @description Replaces the deleted channels with saved ones, keeping any recorded since.
 * @param saved The saved channels, newest first.
 */
export function restoreDeletedChannels(saved: DeletedChannel[]): void {
	const recorded = new Set(channels.map((entry) => entry.id));

	channels = [...channels, ...saved.filter((entry) => !recorded.has(entry.id))].slice(
		0,
		DELETED_CHANNEL_LIMIT,
	);
	notify();
}

/**
 * @description Forgets every deleted channel.
 */
export function clearDeletedChannels(): void {
	channels = [];
	notify();
}

/**
 * @description Reads the saved file's channels, skipping malformed entries.
 * @param text The file's text.
 * @returns The channels, or `undefined` when the file is not a saved log.
 */
export function parseDeletedChannels(text: string): DeletedChannel[] | undefined {
	try {
		const saved = JSON.parse(text) as Partial<SavedChannels> | null;

		if (saved?.version !== 1 || !Array.isArray(saved.channels)) return undefined;

		return saved.channels.filter(isDeletedChannel);
	} catch {
		return undefined;
	}
}

/**
 * @description Writes the channels as the saved file's text.
 * @param entries The channels.
 * @returns The text.
 */
export function serializeDeletedChannels(entries: DeletedChannel[]): string {
	return JSON.stringify({ version: 1, channels: entries } satisfies SavedChannels);
}
