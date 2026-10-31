// UB-129 prototype move: the Android half of ios/mentions.ts. The queue would move to a shared root file.
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import { colorAndroidChatInputMentions } from '~/android/chat-input';
import type { NativeMentions } from '~/ios/mentions';
import { PLUGIN_NAME } from '~/constants';

export function createNativeMentions(context: PluginContext): NativeMentions {
	let queue = Promise.resolve();

	function enqueue(step: () => void | Promise<void>) {
		queue = queue.then(step).catch((error) => {
			if (!isCancellation(error)) {
				console.error(`[${PLUGIN_NAME}] Failed to update native mentions:`, error);
			}
		});
	}

	function enable(): () => void {
		if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) {
			return () => {};
		}

		const remove = colorAndroidChatInputMentions(context.native);

		return () => enqueue(remove);
	}

	return { enable, settled: () => queue };
}
