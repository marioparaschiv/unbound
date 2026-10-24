import { MESSAGE_LINK_PATTERN } from '~/constants';

export type LinkTarget = {
	channelId: string;
	messageId: string;
};

export type TextRange = {
	location: number;
	length: number;
};

type MessageLike = {
	content?: unknown;
};

/**
 * @description Builds the key that identifies a linked message across channels.
 * @param target The linked message.
 * @returns `channelId:messageId`.
 */
export function targetKey({ channelId, messageId }: LinkTarget): string {
	return `${channelId}:${messageId}`;
}

/**
 * @description Converts a Discord role color string into the ARGB number React Native's native text expects.
 * @param value The `#rrggbb` color string.
 * @returns The opaque color as a signed 32-bit ARGB integer, which Android's row parser requires, or `undefined` for anything that is not six hex digits.
 */
export function nativeUsernameColor(value: unknown): number | undefined {
	if (typeof value !== 'string') return;

	const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());

	if (!match) return;

	return Number.parseInt(`ff${match[1]}`, 16) | 0;
}

/**
 * @description Flattens message content, plain or parsed into rich nodes, into its text.
 * @param value The content string or node tree.
 * @returns The concatenated text, including link targets of link nodes.
 */
export function contentText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.map(contentText).join('');
	if (!value || typeof value !== 'object') return '';

	const node = value as { content?: unknown; originalLink?: unknown; text?: unknown };
	const link = typeof node.originalLink === 'string' ? node.originalLink : '';
	const text = typeof node.text === 'string' ? node.text : '';

	return `${contentText(node.content)}${link}${text}`;
}

/**
 * @description Finds every distinct Discord message link in a message.
 * @param message The message to scan.
 * @returns The linked messages, in order of first appearance.
 */
export function linkedTargets(message: MessageLike): LinkTarget[] {
	const targets = new Map<string, LinkTarget>();

	for (const [, channelId, messageId] of contentText(message.content).matchAll(
		MESSAGE_LINK_PATTERN,
	)) {
		const target = { channelId, messageId };

		if (!targets.has(targetKey(target))) targets.set(targetKey(target), target);
	}

	return [...targets.values()];
}

const CHIP_OPENING = '\uFFFC\u2068\u2060\u200B';
const CHIP_CLOSING = '\uFFFC\u2068\u2069\u2060\u2009\u200B';
const CHIP_ICON = /[\uFFFC\u200B]/;

/**
 * @description Locates the rendered channel mention of a message link inside a label's text.
 * @param text The label's plain text.
 * @param channelName The name of the linked message's channel.
 * @returns The range of the mention, including its attachment and bidi markers, or `undefined`.
 */
export function findRenderedLinkRange(text: string, channelName: string): TextRange | undefined {
	if (!channelName) return;

	let searchFrom = 0;

	while (searchFrom < text.length) {
		const location = text.indexOf(channelName, searchFrom);

		if (location === -1) return;

		let start = location;
		let end = location + channelName.length;

		while (start > 0 && CHIP_OPENING.includes(text[start - 1])) start--;
		while (end < text.length && CHIP_CLOSING.includes(text[end])) end++;

		if (
			CHIP_ICON.test(text.slice(start, end)) &&
			start < location &&
			end > location + channelName.length
		) {
			return { location: start, length: end - start };
		}

		searchFrom = location + channelName.length;
	}
}
