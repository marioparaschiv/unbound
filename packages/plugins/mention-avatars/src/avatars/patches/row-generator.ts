import { patcher } from '@unbound-app/api';

import type { MentionIndex } from '~/avatars/mention-index';
import { RowGenerator } from '~/avatars/modules';

/**
 * @description Indexes each message's mentions as Discord builds its chat row.
 * @param index The mention index to fill.
 * The Addon scope removes the patch when the plugin stops.
 */
export function patchRowGenerator(index: MentionIndex): void {
	patcher.after(RowGenerator, 'generateMessageRowData', ({ args }) => {
		index.add(args[0]?.message);
	});
}
