import { colorAndroidChatInputMentions } from '~/android/chat-input';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import { colorMessageMentions } from '~/native/message-cells';
import { colorChatInputMentions } from '~/native/chat-input';
import { PLUGIN_NAME } from '~/constants';

export type NativeMentions = {
	enable: () => () => void;
	settled: () => Promise<void>;
};

/**
 * @description Colors mentions in native message cells and the chat input on iOS, and in the chat input on Android, queueing each enable after the previous teardown so views are restored before they are painted again.
 * @param context The plugin context, whose Objective-C or Java bridge paints the mentions.
 * @returns `enable`, which applies both features and returns their removal, and `settled`, which resolves once queued work finishes.
 */
export function createNativeMentions(context: PluginContext): NativeMentions {
	let queue = Promise.resolve();

	function enqueue(step: () => void | Promise<void>) {
		queue = queue.then(step).catch((error) => {
			console.error(`[${PLUGIN_NAME}] Failed to update native mentions:`, error);
		});
	}

	function enable(): () => void {
		if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) {
			return () => {};
		}

		if (context.platform === 'android') {
			const removeAndroid = colorAndroidChatInputMentions(context.native);

			return () => enqueue(removeAndroid);
		}

		const { objc } = context.native;
		const removers: (() => Promise<void>)[] = [];

		enqueue(() => {
			for (const apply of [colorMessageMentions, colorChatInputMentions]) {
				try {
					removers.push(apply(objc));
				} catch (error) {
					console.error(`[${PLUGIN_NAME}] Failed to color native mentions:`, error);
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

	return { enable, settled: () => queue };
}

export default createNativeMentions;
