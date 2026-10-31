import { patcher } from '@unbound-app/api';

import type { MentionIndex } from '~/mention-index';
import { RowGenerator } from '~/modules';

/**
 * @description Indexes each message's mentions as Discord builds its chat row.
 * @param index The mention index to fill.
 * @returns A function that removes the patch.
 */
export function patchRowGenerator(index: MentionIndex): () => void {
	return patcher.after(RowGenerator, 'generateMessageRowData', ({ args }) => {
		index.add(args[0]?.message);
	});
}

export default patchRowGenerator;
