import { collectMentions, type Message } from '~/resolve-mentions';
import { MessageStore, SelectedChannelStore } from '~/modules';
import type { Mention } from '~/mentions';

export type MentionIndex = ReturnType<typeof createMentionIndex>;

/**
 * @description Creates the per-message record of resolved mentions that the native renderer reads.
 * @param includeRoles Whether role mentions can be resolved.
 * @returns The index.
 */
export function createMentionIndex(includeRoles: boolean) {
	const mentionsByMessage = new Map<string, Mention[]>();
	const unresolved = new Set<string>();
	let hydratedKey: string | null = null;

	function add(message: Message | undefined) {
		if (typeof message?.id !== 'string') return;

		const { id } = message;

		const { complete, mentions } = collectMentions(message, includeRoles);

		if (complete) {
			unresolved.delete(id);
		} else {
			unresolved.add(id);
		}

		mentionsByMessage.set(id, mentions);
	}

	// Indexes the selected channel's loaded messages, skipping the work when nothing changed.
	function hydrateChannel() {
		const channelId = SelectedChannelStore.getChannelId();
		const messages: Message[] | undefined = MessageStore.getMessages(channelId)?._array;

		if (!Array.isArray(messages)) return;

		const key = `${channelId}:${messages.length}:${messages.at(-1)?.id ?? ''}`;

		if (key === hydratedKey && !unresolved.size) return;

		hydratedKey = key;

		for (const message of messages) add(message);
	}

	function hydrateMessage(id: string | undefined, channelId?: string): boolean {
		if (!id) return false;

		const message = MessageStore.getMessage(
			channelId ?? SelectedChannelStore.getChannelId(),
			id,
		);

		if (!message) return false;

		add(message);

		return true;
	}

	return {
		add,
		hydrateChannel,
		hydrateMessage,
		get: (id: string): Mention[] => mentionsByMessage.get(id) ?? [],
		all: (): Mention[] => [...new Set([...mentionsByMessage.values()].flat())],
		isUnresolved: (id: string) => unresolved.has(id),
		clear() {
			mentionsByMessage.clear();
			unresolved.clear();
			hydratedKey = null;
		},
	};
}

export default createMentionIndex;
