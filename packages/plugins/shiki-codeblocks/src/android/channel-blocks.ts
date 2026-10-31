import { parseFencedCodeBlocks, type CodeBlock } from '~/fences';
import { MessageStore, SelectedChannelStore } from '~/modules';

/**
 * @description Collects the fenced code blocks of every loaded message in the selected channel.
 * @returns The code blocks, in message order.
 */
export function channelBlocks(): CodeBlock[] {
	const channelId = SelectedChannelStore.getChannelId();
	const messages = MessageStore.getMessages(channelId)?._array ?? [];

	return messages.flatMap((message) =>
		typeof message.content === 'string' && message.content.includes('```')
			? parseFencedCodeBlocks(message.content)
			: [],
	);
}

export default channelBlocks;
