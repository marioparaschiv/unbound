import type { PluginContext } from '@unbound-app/api/native';
import { flux, native } from '@unbound-app/api';

import type { LatencyMessage } from '~/lib/latency';
import { MessageStore, SelectedChannelStore } from '~/lib/modules';
import { drawnRecords } from '~/native/indicators';
import type { LatencyRecords } from '~/lib/records';

type MessageCreate = {
	message?: LatencyMessage | null;
};

type ChannelSelect = {
	channelId?: string | null;
};

function measureHeldMessages(records: LatencyRecords, channelId: string | null | undefined) {
	if (!channelId) return;

	for (const message of MessageStore.getMessages?.(channelId)?.toArray?.() ?? []) {
		if (message.id != null && !records.has(String(message.id))) records.update(message);
	}
}

/**
 * @description Measures the messages Discord still holds for each opened channel, so a reload keeps their badges, and every message as it arrives, through the native runtime when available or Discord's dispatcher otherwise, while the indicators are drawn.
 * @param context The plugin context, whose native runtime bridge is used when the loader provides runtime events.
 */
export function listenToMessages(context: PluginContext): void {
	const records = drawnRecords();

	if (!records) return;

	measureHeldMessages(records, SelectedChannelStore.getChannelId?.());
	flux.onAction('CHANNEL_SELECT', ({ channelId }: ChannelSelect) =>
		measureHeldMessages(records, channelId),
	);

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
