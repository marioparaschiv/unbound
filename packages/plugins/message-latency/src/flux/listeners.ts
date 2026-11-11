import type { PluginContext } from '@unbound-app/api/native';
import { flux, native } from '@unbound-app/api';

import type { LatencyMessage } from '~/lib/latency';
import { drawnRecords } from '~/native/indicators';

type MessageCreate = {
	message?: LatencyMessage | null;
};

/**
 * @description Measures every message as it arrives, through the native runtime when available or Discord's dispatcher otherwise, while the indicators are drawn.
 * @param context The plugin context, whose native runtime bridge is used when the loader provides runtime events.
 */
export function listenToMessages(context: PluginContext): void {
	const records = drawnRecords();

	if (!records) return;

	function onMessageCreate({ message }: MessageCreate) {
		if (!message) return;

		records?.update(message, message.author?.username);
	}

	if (native.has('native.runtime.events')) {
		try {
			context.native.runtime.subscribe('message.created', onMessageCreate);

			return;
		} catch {
			// The runtime refused the subscription; the dispatcher delivers the same event.
		}
	}

	flux.onAction('MESSAGE_CREATE', onMessageCreate);
}
