import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type { NativeBridge } from '@unbound-app/api/native';

import type { Enqueue } from '~/native/mentions';
import { colorMessageMentions, MESSAGE_CELL_CLASS } from '~/native/ios/message-cells';
import { CHAT_INPUT_CLASS, colorChatInputMentions } from '~/native/ios/chat-input';

const PAINTER_CLASSES = {
	'Chat mentions': MESSAGE_CELL_CLASS,
	'Composer mentions': CHAT_INPUT_CLASS,
};

/**
 * @description Colors mentions in native message cells and the chat input on iOS.
 * @param native The plugin's native bridge.
 * @param enqueue Runs a step after the previous enable or removal finished.
 * @returns A function that queues the removal of both features.
 */
export function enableMentions(native: NativeBridge, enqueue: Enqueue): () => void {
	const removers: (() => Promise<void>)[] = [];

	enqueue(() => {
		for (const apply of [
			() => colorMessageMentions(native),
			() => colorChatInputMentions(native),
		]) {
			try {
				removers.push(apply());
			} catch (error) {
				if (!isCancellation(error)) {
					logger.error(`Failed to color native mentions:`, error);
				}
			}
		}
	});

	return () =>
		enqueue(async () => {
			for (const result of await Promise.allSettled(removers.map((remove) => remove()))) {
				if (result.status === 'rejected') {
					logger.error(`Failed to restore native mentions:`, result.reason);
				}
			}
		});
}

/**
 * @description Names the painters {@link enableMentions} skipped because Discord lacks their class.
 * @param native The plugin's native bridge.
 * @returns One skip line per missing class, empty when every painter runs.
 */
export function findSkippedPainters(native: NativeBridge): string[] {
	return Object.entries(PAINTER_CLASSES)
		.filter(([, name]) => !native.objc.getClass(name))
		.map(([feature, name]) => `${feature} skipped: native classes not found: ${name}.`);
}

export default enableMentions;

export const ROLE_MENTION_COLORS = true;
