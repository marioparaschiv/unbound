import { onMessageRow, type MessageRow } from '@unbound-plugins/shared/metro/message-rows';

import { normalizeName } from '~/lib/normalize';

type NamedRow = MessageRow & {
	referencedMessage?: { message?: { username?: string } };
};

/**
 * @description Writes author names in plain letters on every chat row, and on the reply preview above it. Hooks
 * `generateMessageRowData` after it runs.
 */
export function patchMessageRows(): void {
	onMessageRow<never, NamedRow>({
		feature: 'Normalized names',
		after({ row }) {
			if (typeof row?.username === 'string') row.username = normalizeName(row.username);

			const reply = row?.referencedMessage?.message;

			if (typeof reply?.username === 'string') reply.username = normalizeName(reply.username);
		},
	});
}
