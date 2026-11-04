import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { MetroFunction } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import type { PendingRows } from '~/embeds/redraw';
import { byRowManager } from '~/embeds/modules';

const CHANGE_TYPE_UPDATE = 1;
// Discord's native chat list calls `RowManager.generate` for one row at a time, on its own schedule, after
// `MessageStore` changes. Nothing in JS says when the last redrawn row was generated (no event, promise or
// batch), so no ordering can hold `stop` open exactly long enough. It outlasts `REBIND_ALL_MS` in redraw.ts.
const REBIND_GRACE_MS = 1600;

type GeneratedRow = {
	changeType?: unknown;
	message?: { id?: unknown } | null;
};

/**
 * @description Marks the rows of messages whose branding just arrived as changed, so the native chat list binds them again instead of keeping the drawn embed.
 * @param pending The rows waiting for branding that is still loading.
 * The Addon scope removes the patch when the plugin stops, so the returned function holds `stop` open until the redrawn rows were bound.
 * @returns A function that resolves once the rows drawn with DeArrow branding were bound again.
 */
export function patchRowRebind(pending: PendingRows): () => Promise<void> {
	whenLoaded(byRowManager, (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') return;

		return patcher.after(RowManager.prototype, 'generate', ({ result }) => {
			const row = result as GeneratedRow | undefined;
			const id = row?.message?.id;

			if (typeof id === 'string' && pending.takeRebind(id))
				row!.changeType = CHANGE_TYPE_UPDATE;
		});
	});

	return () => new Promise((resolve) => setTimeout(resolve, REBIND_GRACE_MS));
}
