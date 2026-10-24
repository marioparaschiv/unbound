import { MessageActions, MessageStore, type Message } from '~/modules';
import { targetKey, type LinkTarget } from '~/link-targets';

export type LinkedMessages = ReturnType<typeof createLinkedMessages>;

/**
 * @description Caches the messages that links point to, fetching the ones Discord has not loaded.
 * @param signal Aborted when the plugin stops, to drop fetches still in flight.
 * @param onSettled Called with the target's key when a fetch finishes, found or not.
 * @returns `get` reads a linked message, `fetch` requests a missing one, `clear` forgets them all.
 */
export function createLinkedMessages(signal: AbortSignal, onSettled: (key: string) => void) {
	const cache = new Map<string, Message>();
	const pending = new Set<string>();

	function get(target: LinkTarget): Message | undefined {
		const key = targetKey(target);
		const message =
			cache.get(key) ?? MessageStore.getMessage(target.channelId, target.messageId);

		if (message) cache.set(key, message);

		return message;
	}

	function fetch(target: LinkTarget) {
		const key = targetKey(target);

		if (pending.has(key) || get(target)) return;

		let request: Promise<Message | null>;

		try {
			request = MessageActions.fetchMessage(target);
		} catch {
			return;
		}

		pending.add(key);

		void request
			.then((result) => {
				if (signal.aborted) return;

				const message =
					MessageStore.getMessage(target.channelId, target.messageId) ?? result;

				if (message) cache.set(key, message);
			})
			.catch(() => undefined)
			.finally(() => {
				pending.delete(key);

				if (!signal.aborted) onSettled(key);
			});
	}

	function clear() {
		cache.clear();
		pending.clear();
	}

	return { get, fetch, clear };
}
