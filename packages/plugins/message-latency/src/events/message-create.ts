import type { PluginContext } from '@unbound-app/api/native';
import { metro } from '@unbound-app/api';

import type { LatencyRecords } from '~/records';
import type { LatencyMessage } from '~/latency';

type MessageCreate = {
	message?: LatencyMessage | null;
};

/**
 * @description Measures every message as it arrives, through the native runtime when available or Discord's dispatcher otherwise.
 * @param records The latency cache to fill.
 * @param context The plugin context, whose runtime events are used when granted.
 * @returns A function that unsubscribes.
 */
export function subscribeMessageCreate(
	records: LatencyRecords,
	context: PluginContext,
): () => void {
	function onMessageCreate({ message }: MessageCreate) {
		if (!message) return;

		records.update(message, message.author?.username);
	}

	if (context.capabilities.includes('native.runtime.events')) {
		try {
			const token = context.native.runtime.subscribe('message.created', onMessageCreate);

			return () => token.remove();
		} catch {
			// The runtime refused the subscription; the dispatcher delivers the same event.
		}
	}

	metro.common.Dispatcher.subscribe('MESSAGE_CREATE', onMessageCreate);

	return () => metro.common.Dispatcher.unsubscribe('MESSAGE_CREATE', onMessageCreate);
}

export default { subscribeMessageCreate };
