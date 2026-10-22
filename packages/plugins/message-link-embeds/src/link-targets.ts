const MESSAGE_LINK_REGEX =
	/https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(?:(?:\d{17,20}|@me)\/)?(\d{17,20})\/(\d{17,20})/g;

export type LinkTarget = {
	channelId: string;
	messageId: string;
};

export type TextRange = {
	location: number;
	length: number;
};

export function nativeUsernameColor(value: unknown): number | undefined {
	if (typeof value !== 'string') return;
	const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
	if (!match) return;
	return Number.parseInt(`ff${match[1]}`, 16);
}

type MessageLike = {
	content?: unknown;
};

export function contentText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.map(contentText).join('');
	if (!value || typeof value !== 'object') return '';

	const record = value as Record<string, unknown>;
	return `${contentText(record.content)}${typeof record.originalLink === 'string' ? record.originalLink : ''}${typeof record.text === 'string' ? record.text : ''}`;
}

export function linkedTargets(message: MessageLike): LinkTarget[] {
	const text = contentText(message.content);
	if (!text) return [];

	const targets: LinkTarget[] = [];
	for (const match of text.matchAll(MESSAGE_LINK_REGEX)) {
		const target = { channelId: match[1], messageId: match[2] };
		if (!target.channelId || !target.messageId) continue;
		if (
			!targets.some(
				(item) =>
					item.channelId === target.channelId && item.messageId === target.messageId,
			)
		)
			targets.push(target);
	}
	return targets;
}

export function findRenderedLinkRange(text: string, channelName: string): TextRange | undefined {
	if (!channelName) return;
	let searchFrom = 0;
	while (searchFrom < text.length) {
		const location = text.indexOf(channelName, searchFrom);
		if (location === -1) return;
		let start = location;
		let end = location + channelName.length;
		while (start > 0 && '\uFFFC\u2068'.includes(text[start - 1])) start--;
		while (end < text.length && '\uFFFC\u2068\u2069'.includes(text[end])) end++;
		const renderedLink = text.slice(start, end);
		if (
			renderedLink.includes('\uFFFC') &&
			start < location &&
			end > location + channelName.length
		) {
			return { location: start, length: end - start };
		}
		searchFrom = location + channelName.length;
	}
}
