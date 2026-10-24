import { Patcher, RowManager } from '~/modules';
import { chat } from '~/chat';

/**
 * @description Remembers the open chat's row manager so the chat can be refreshed.
 * @returns A function that removes the patch.
 */
export function patchRowManager(): () => void {
	if (typeof RowManager.prototype?.generate !== 'function') {
		console.error('[No Blocked Messages] Skipped, RowManager.generate not found.');

		return () => {};
	}

	return Patcher.before(RowManager.prototype, 'generate', ({ this: self }) => {
		chat.rowManager = self;
	});
}
