import { ChannelStore, type Message } from '~/embeds/modules';
import type { LinkTarget } from '~/embeds/link-targets';

/**
 * @description Finds the channel name Discord renders in the mention of a message link.
 * @param target The linked message.
 * @param message The linked message's data, used when the channel is not in the store.
 * @returns The channel's name, or `undefined` when it is unknown.
 */
export function linkedChannelName(target: LinkTarget, message: Message): string | undefined {
	const fromStore = ChannelStore.getChannel(target.channelId)?.name;

	if (fromStore) return fromStore;

	const fromMessage = message.channelName ?? message.channel_name;

	return typeof fromMessage === 'string' && fromMessage.length > 0 ? fromMessage : undefined;
}
