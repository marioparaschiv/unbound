import { patcher } from '@unbound-app/api';

import type { LatencyRecords } from '~/latency-indicator/records';
import type { LatencyMessage } from '~/latency-indicator/latency';
import { MessageRowData } from '~/latency-indicator/modules';

type RowArgs = [{ message?: LatencyMessage }?];
type RowResult = { message?: { username?: string } } | undefined;

/**
 * @description Measures each message Discord builds a chat row for, once the row module loads. The row itself is not changed.
 * @param records The latency cache to fill.
 */
export function patchMessageRowData(records: LatencyRecords): void {
	patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const [input] = args as RowArgs;
		const username = (result as RowResult)?.message?.username;

		if (!input?.message) return;

		records.update(input.message, typeof username === 'string' ? username : undefined);
	});
}

export default { patchMessageRowData };
