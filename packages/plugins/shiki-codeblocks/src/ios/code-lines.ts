import { parseFencedCodeBlocks } from '~/fences';
import { MessageStore } from '~/modules';

type MessageContent = {
	content?: unknown;
	messageSnapshots?: { message?: { content?: unknown } }[];
};

type LoadedMessages = { toArray?: () => MessageContent[] };

const REFRESH_MS = 500;

let cached: { channelId: string; at: number; lines: string[] } | undefined;

function contentsOf(message: MessageContent): string[] {
	const contents = [
		message.content,
		...(message.messageSnapshots ?? []).map((snapshot) => snapshot.message?.content),
	];

	return contents.filter((content): content is string => typeof content === 'string');
}

export function codeLinesOf(messages: MessageContent[]): string[] {
	const lines: string[] = [];

	for (const content of messages.flatMap(contentsOf)) {
		if (!content.includes('```')) continue;

		for (const block of parseFencedCodeBlocks(content)) {
			const line = block.code.split('\n').find((candidate) => candidate.trim());

			if (line) lines.push(line.trim());
		}
	}

	return lines;
}

export function mayShowCode(rendered: string, lines: string[] | undefined): boolean {
	return !lines || lines.some((line) => rendered.includes(line));
}

export function channelCodeLines(channelId: string | undefined): string[] | undefined {
	if (!channelId) return undefined;

	const now = Date.now();

	if (cached?.channelId === channelId && now - cached.at < REFRESH_MS) return cached.lines;

	const list = MessageStore.getMessages?.(channelId) as unknown as LoadedMessages | undefined;
	const messages = list?.toArray?.();

	if (!messages) return undefined;

	cached = { channelId, at: now, lines: codeLinesOf(messages) };

	return cached.lines;
}
