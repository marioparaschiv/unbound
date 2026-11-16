import { escapeMarkdown } from 'discord.js';

import { containerMessage, textDisplay, type ContainerMessage } from '~/lib/container-message';
import { truncate } from '~/lib/message-text';

/** Which of the server's log channels an event goes to; bans and timeouts post as cases to the mod log instead. */
export type LogKind = 'messages' | 'misc' | 'joins';

/** One server event, as its log post reads. */
export type LogEntry = {
	kind: LogKind;
	title: string;
	colour: number;
	/** The user the event is about, named next to the title. */
	user?: { id: string; name: string };
	/** The body, one Markdown block per item. */
	lines?: string[];
	/** The id of what changed, for search; the user's id when there is a user. */
	footer?: string;
};

/** A rendered log post, sendable as an `OutgoingMessage`; it can never ping anyone. */
export type LogPost = { body: ContainerMessage & { allowed_mentions: { parse: [] } } };

const NAME_LIMIT = 128;

/**
 * @description Renders a server event as a compact post: the title and user, the body, then the id.
 * @param entry The event.
 * @returns The message body.
 */
export function renderLogPost({ title, colour, user, lines = [], footer }: LogEntry): LogPost {
	const who = user ? ` · ${escapeMarkdown(truncate(user.name, NAME_LIMIT))} <@${user.id}>` : '';
	const id = footer ?? user?.id;
	const text = [`**${title}**${who}`, ...lines, id ? `-# ID: ${id}` : undefined]
		.filter((line) => line !== undefined && line !== '')
		.join('\n');

	return {
		body: { ...containerMessage(colour, [textDisplay(text)]), allowed_mentions: { parse: [] } },
	};
}

/**
 * @description Writes a count as an English ordinal, e.g. `16,917th`.
 * @param count The count.
 * @returns The ordinal.
 */
export function ordinal(count: number): string {
	const lastTwo = count % 100;
	const suffix =
		lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[count % 10] ?? 'th');

	return `${count.toLocaleString('en-US')}${suffix}`;
}

export default { renderLogPost, ordinal };
