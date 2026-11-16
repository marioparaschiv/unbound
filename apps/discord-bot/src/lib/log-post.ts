import { containerMessage, textDisplay, type ContainerMessage } from '~/lib/container-message';
import type { LogIconKey, LogIcons } from '~/lib/log-icons';
import { field, person } from '~/lib/post-fields';

/** Which of the server's log channels an event goes to; bans and timeouts post as cases to the mod log instead. */
export type LogKind = 'messages' | 'misc' | 'joins';

/** One server event, as its log post reads. */
export type LogEntry = {
	kind: LogKind;
	title: string;
	/** The icon before the title, once its emoji is uploaded. */
	icon?: LogIconKey;
	colour: number;
	/** The user the event is about, shown as the first field. */
	user?: { id: string; name: string };
	/** The body, one Markdown block per item, spaced apart like embed fields; empty items are dropped. */
	lines?: string[];
	/** The id of what changed, for search, under the body. */
	footer?: string;
};

/** A rendered log post, sendable as an `OutgoingMessage`; it can never ping anyone. */
export type LogPost = { body: ContainerMessage & { allowed_mentions: { parse: [] } } };

/**
 * @description Renders a server event as a case post reads: the title, the user field, the body, then the id.
 * @param entry The event.
 * @param icons The event icon emojis.
 * @returns The message body.
 */
export function renderLogPost(
	{ title, icon, colour, user, lines = [], footer }: LogEntry,
	icons: LogIcons = new Map(),
): LogPost {
	const emoji = icon && icons.get(icon);
	const blocks = [
		`### ${emoji ? `<:${emoji.name}:${emoji.id}> ` : ''}${title}`,
		user ? field('User', person(user.id)) : '',
		...lines,
		footer ? `-# ID: ${footer}` : '',
	].filter(Boolean);

	return {
		body: {
			...containerMessage(colour, blocks.map(textDisplay)),
			allowed_mentions: { parse: [] },
		},
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
