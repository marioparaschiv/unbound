import type { NativeRuntimeBridge } from '@unbound-app/api/native';
import { flux, native } from '@unbound-app/api';

import type { LatencyRecords } from '~/records';
import type { LatencyMessage } from '~/latency';

type MessageCreate = {
	message?: LatencyMessage | null;
};

/**
 * @description Measures every message as it arrives, through the native runtime when available or Discord's dispatcher otherwise.
 * @param records The latency cache to fill.
 * @param runtime The native runtime bridge from `context.native`, used when the loader provides runtime events.
 * @returns A function that unsubscribes.
 */
export function subscribeMessageCreate(
	records: LatencyRecords,
	runtime: NativeRuntimeBridge,
): () => void {
	function onMessageCreate({ message }: MessageCreate) {
		if (!message) return;

		records.update(message, message.author?.username);
	}

	if (native.has('native.runtime.events')) {
		try {
			const token = runtime.subscribe('message.created', onMessageCreate);

			return () => token.remove();
		} catch {
			// The runtime refused the subscription; the dispatcher delivers the same event.
		}
	}

	return flux.onAction('MESSAGE_CREATE', onMessageCreate);
}

export default { subscribeMessageCreate };
