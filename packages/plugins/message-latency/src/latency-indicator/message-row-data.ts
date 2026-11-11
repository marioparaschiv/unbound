import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';

import type { LatencyRecords } from '~/latency-indicator/records';
import type { LatencyMessage } from '~/latency-indicator/latency';

/**
 * @description Measures each message Discord builds a chat row for, once the row module loads. The row itself is not changed.
 * @param records The latency cache to fill.
 * @returns A function that removes the patch.
 */
export function patchMessageRowData(records: LatencyRecords): () => void {
	return onMessageRow<RowMessage & LatencyMessage>({
		after({ message, row }) {
			if (!message) return;

			records.update(message, typeof row?.username === 'string' ? row.username : undefined);
		},
	});
}

export default { patchMessageRowData };
