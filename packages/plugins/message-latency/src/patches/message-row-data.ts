import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import { MessageRowDataFilter, Patcher } from '~/modules';
import type { LatencyRecords } from '~/records';
import type { LatencyMessage } from '~/latency';

type RowArgs = [{ message?: LatencyMessage }?];
type RowResult = { message?: { username?: string } } | undefined;

/**
 * @description Measures each message Discord builds a chat row for, once the row module loads. The row itself is not changed.
 * @param records The latency cache to fill.
 * @returns A function that stops waiting for the module and removes the patch.
 */
export function patchMessageRowData(records: LatencyRecords): () => void {
	return whenLoaded(MessageRowDataFilter, (MessageRowData: AnyProps) =>
		Patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
			const [input] = args as RowArgs;
			const username = (result as RowResult)?.message?.username;

			if (!input?.message) return;

			records.update(input.message, typeof username === 'string' ? username : undefined);
		}),
	);
}

export default { patchMessageRowData };
