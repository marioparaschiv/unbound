import { metro } from '@unbound-app/api';

type MessagePage = { body?: unknown };

type FetchOldestPage = (channelId: string) => Promise<MessagePage>;

const firstMessages = new Map<string, string>();

function fetchOldestPage(channelId: string): Promise<MessagePage> {
	const { REST, Constants } = metro.common;

	return REST.get({
		url: Constants.Endpoints.MESSAGES(channelId),
		query: { after: '0', limit: 1 },
	});
}

function oldestId(page: MessagePage): string | undefined {
	if (!Array.isArray(page.body)) return;

	const id: unknown = page.body[0]?.id;

	return typeof id === 'string' ? id : undefined;
}

/**
 * @description Finds a channel's first message, asking Discord once per channel and session.
 * @param channelId The channel to look in.
 * @param fetchOldest Loads the oldest page of messages; Discord's REST client by default.
 * @returns The first message's id, or undefined for an empty channel.
 */
export async function findFirstMessageId(
	channelId: string,
	fetchOldest: FetchOldestPage = fetchOldestPage,
): Promise<string | undefined> {
	const known = firstMessages.get(channelId);

	if (known) return known;

	const id = oldestId(await fetchOldest(channelId));

	if (id) firstMessages.set(channelId, id);

	return id;
}

/**
 * @description Forgets every first message found so far.
 */
export function forgetFirstMessages(): void {
	firstMessages.clear();
}
