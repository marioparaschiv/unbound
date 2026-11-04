import { collectMentions, type Message } from '~/resolve-mentions';
import { MessageStore, SelectedChannelStore } from '~/modules';
import { MAX_MENTION_REFRESHES } from '~/constants';
import type { Mention } from '~/mentions';

export type MentionIndex = ReturnType<typeof createMentionIndex>;

export type MentionTarget = {
	id: string;
	channelId?: string;
};

type IndexedMessage = Message & { id: string };

function hasId(message: Message | undefined): message is IndexedMessage {
	return typeof message?.id === 'string';
}

function channelOf(message: Message | undefined): string | undefined {
	return message?.channel_id ?? message?.channelId;
}

/**
 * @description Creates the per-message record of resolved mentions that the native renderer reads.
 * @param includeRoles Whether role mentions can be resolved.
 * @returns The index.
 */
export function createMentionIndex(includeRoles: boolean) {
	const mentionsByMessage = new Map<string, Mention[]>();
	const indexed = new Map<string, Message>();
	const unresolved = new Set<string>();
	const refreshes = new Map<string, number>();
	let hydratedKey: string | null = null;

	function collect(message: IndexedMessage) {
		const { id } = message;
		const { complete, mentions } = collectMentions(message, includeRoles);

		indexed.set(id, message);

		if (complete) {
			unresolved.delete(id);
			refreshes.delete(id);
		} else {
			unresolved.add(id);
		}

		mentionsByMessage.set(id, mentions);
	}

	function add(message: Message | undefined) {
		if (hasId(message) && !isCurrent(message)) collect(message);
	}

	function isCurrent(message: IndexedMessage): boolean {
		return indexed.get(message.id) === message && !unresolved.has(message.id);
	}

	function selectedMessages():
		| { channelId: string | undefined; messages: Message[] }
		| undefined {
		const channelId = SelectedChannelStore.getChannelId();
		const messages: Message[] | undefined = MessageStore.getMessages(channelId)?._array;

		return Array.isArray(messages) ? { channelId, messages } : undefined;
	}

	function hydrateChannel() {
		const selected = selectedMessages();

		if (!selected) return;

		const { channelId, messages } = selected;
		const key = `${channelId}:${messages.length}:${messages[0]?.id ?? ''}:${messages.at(-1)?.id ?? ''}`;

		if (key === hydratedKey) return;

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

		refreshes.delete(id);
		add(message);

		return true;
	}

	function exhausted(id: string): boolean {
		return (refreshes.get(id) ?? 0) >= MAX_MENTION_REFRESHES;
	}

	function refreshOne({ id, channelId }: MentionTarget): boolean {
		if (exhausted(id)) return false;

		const wasIndexed = indexed.has(id);
		const before = JSON.stringify(mentionsByMessage.get(id) ?? []);
		const message: Message | undefined = MessageStore.getMessage(
			channelId ?? channelOf(indexed.get(id)) ?? SelectedChannelStore.getChannelId(),
			id,
		);

		if (hasId(message)) collect(message);

		const changed =
			Boolean(message) &&
			(!wasIndexed ||
				!unresolved.has(id) ||
				JSON.stringify(mentionsByMessage.get(id)) !== before);

		if (!changed) refreshes.set(id, (refreshes.get(id) ?? 0) + 1);

		return changed;
	}

	function refresh(targets?: Iterable<MentionTarget>): Set<string> {
		const changed = new Set<string>();
		const pending = targets ?? [...unresolved].map((id) => ({ id }));

		for (const target of pending) {
			if (refreshOne(target)) changed.add(target.id);
		}

		return changed;
	}

	function recheckChannel() {
		hydrateChannel();

		for (const message of selectedMessages()?.messages ?? []) {
			if (hasId(message) && unresolved.has(message.id)) collect(message);
		}
	}

	return {
		add,
		hydrateChannel,
		recheckChannel,
		hydrateMessage,
		refresh,
		exhausted,
		get: (id: string): Mention[] => mentionsByMessage.get(id) ?? [],
		all: (): Mention[] => [...new Set([...mentionsByMessage.values()].flat())],
		isUnresolved: (id: string) => unresolved.has(id),
		isSettledEmpty: (id: string) =>
			indexed.has(id) && !unresolved.has(id) && !mentionsByMessage.get(id)?.length,
		clear() {
			mentionsByMessage.clear();
			indexed.clear();
			unresolved.clear();
			refreshes.clear();
			hydratedKey = null;
		},
	};
}

export default createMentionIndex;
