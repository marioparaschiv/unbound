import type { NativePluginBridge } from '@unbound-app/api/native';

import { colorAndroidChatInputMentions } from '~/native/chat-input-android';
import type { Enqueue } from '~/native/mentions';

/**
 * @description Colors mentions in the chat input on Android.
 * @param native The plugin's native bridge.
 * @param enqueue Runs a step after the previous enable or removal finished.
 * @returns A function that queues the removal.
 */
export function enableMentions(native: NativePluginBridge, enqueue: Enqueue): () => void {
	const remove = colorAndroidChatInputMentions(native);

	return () => enqueue(remove);
}

/**
 * @description Names the painters {@link enableMentions} skipped; the Android painter needs no Discord class, so none.
 * @returns An empty list.
 */
export function findSkippedPainters(): string[] {
	return [];
}

export default enableMentions;

export const ROLE_MENTION_COLORS = false;
