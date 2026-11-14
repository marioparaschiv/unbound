import { flux, metro } from '@unbound-app/api';

import { firstFound, newer, type FoundMessage } from '~/lib/newest';

type Endpoints = { SEARCH_GUILD(id: string): string; SEARCH_CHANNEL(id: string): string };

type REST = { get(request: { url: string; query: object }): Promise<{ body?: object }> };

type ChannelStore = { getDMFromUserId?(userId: string): string | undefined };

const cache = new Map<string, Promise<FoundMessage | undefined>>();

const settled = new Map<string, FoundMessage | null>();

/**
 * @description Reads a search that already finished.
 * @param userId The user.
 * @param guildId The server, if any.
 * @returns The message, `null` when the search found none, or `undefined` while it runs or before it starts.
 */
export function settledMessage(
	userId: string,
	guildId: string | undefined,
): FoundMessage | null | undefined {
	return settled.get(`${userId}:${guildId ?? ''}`);
}

async function search(url: string, authorId: string): Promise<FoundMessage | undefined> {
	const { REST } = metro.common as { REST: REST };

	try {
		const response = await REST.get({ url, query: { author_id: authorId, limit: 1 } });

		return firstFound(response.body);
	} catch (error) {
		logger.error(`Failed to search the messages of ${authorId}:`, error);

		return undefined;
	}
}

/**
 * @description Finds a user's newest message in a server and in your DM with them, asking Discord's search once per user
 * and server.
 * @param userId The user.
 * @param guildId The server whose profile is open, if any.
 * @returns The newer of the two, or `undefined` when neither has one.
 */
export function lastMessage(
	userId: string,
	guildId: string | undefined,
): Promise<FoundMessage | undefined> {
	const key = `${userId}:${guildId ?? ''}`;
	const known = cache.get(key);

	if (known) return known;

	const { Endpoints } = metro.common.Constants as { Endpoints: Endpoints };
	const dm = (flux.getStore('Channel') as unknown as ChannelStore).getDMFromUserId?.(userId);
	const found = Promise.all([
		guildId ? search(Endpoints.SEARCH_GUILD(guildId), userId) : undefined,
		dm ? search(Endpoints.SEARCH_CHANNEL(dm), userId) : undefined,
	]).then(([inGuild, inDM]) => {
		const message = newer(inGuild, inDM);

		settled.set(key, message ?? null);

		return message;
	});

	cache.set(key, found);

	return found;
}

/**
 * @description Forgets every search, so profiles opened later search again.
 */
export function forgetSearches(): void {
	cache.clear();
	settled.clear();
}
