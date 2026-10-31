import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type { NativePluginBridge } from '@unbound-app/api/native';

import type { Enqueue } from '~/native-mentions';
import { colorMessageMentions } from '~/ios/message-cells';
import { colorChatInputMentions } from '~/ios/chat-input';
import { PLUGIN_NAME } from '~/constants';

/**
 * @description Colors mentions in native message cells and the chat input on iOS.
 * @param native The plugin's native bridge.
 * @param enqueue Runs a step after the previous enable or removal finished.
 * @returns A function that queues the removal of both features.
 */
export function enableMentions(native: NativePluginBridge, enqueue: Enqueue): () => void {
	const removers: (() => Promise<void>)[] = [];

	enqueue(() => {
		for (const apply of [
			() => colorMessageMentions(native.objc),
			() => colorChatInputMentions(native),
		]) {
			try {
				removers.push(apply());
			} catch (error) {
				if (!isCancellation(error)) {
					console.error(`[${PLUGIN_NAME}] Failed to color native mentions:`, error);
				}
			}
		}
	});

	return () =>
		enqueue(async () => {
			for (const result of await Promise.allSettled(removers.map((remove) => remove()))) {
				if (result.status === 'rejected') {
					console.error(
						`[${PLUGIN_NAME}] Failed to restore native mentions:`,
						result.reason,
					);
				}
			}
		});
}

export default enableMentions;

export const ROLE_MENTION_COLORS = true;
