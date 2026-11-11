import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';

import type { LatencyMessage } from '~/lib/latency';
import { drawnRecords } from '~/native/indicators';

/**
 * @description Measures each message Discord builds a chat row for, once the row module loads. The row itself is not changed.
 * Patches `generateMessageRowData` on Discord's message row module, while the indicators are drawn.
 */
export function patchMessageRows(): void {
	const records = drawnRecords();

	if (!records) return;

	onMessageRow<RowMessage & LatencyMessage>({
		feature: 'Row measuring',
		after({ message, row }) {
			if (!message) return;

			records.update(message, typeof row?.username === 'string' ? row.username : undefined);
		},
	});
}
