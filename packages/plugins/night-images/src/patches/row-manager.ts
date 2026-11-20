import { metro, patcher } from '@unbound-app/api';
import type { MetroFunction } from '@unbound-app/api/metro';

import { dimmedOpacity, isActive, isBrightPlaceholder } from '~/lib/dimming';

type Attachment = { attachmentType?: string; placeholder?: string | null };

type ChatRowMessage = { attachments?: Attachment[] | null; attachmentsOpacity?: number | null };

type ChatRow = { message?: ChatRowMessage };

const DIMMED_TYPES = new Set(['image', 'video']);

function isBright(attachment: Attachment): boolean {
	if (!DIMMED_TYPES.has(attachment.attachmentType ?? '')) return false;

	return isBrightPlaceholder(attachment.placeholder);
}

function dimRow(row: ChatRow | undefined): void {
	const message = row?.message;

	if (!message?.attachments?.some(isBright) || !isActive()) return;

	message.attachmentsOpacity = Math.min(message.attachmentsOpacity ?? 1, dimmedOpacity());
}

/**
 * @description Dims bright attachments in every chat row, by patching `RowManager.prototype.generate` once it loads.
 */
export function patchRowManager(): void {
	metro.onModuleLoaded(metro.filters.byName('RowManager'), (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			logger.warn('Night images skipped: Discord moved RowManager.prototype.generate.');

			return;
		}

		patcher.after(RowManager.prototype, 'generate', ({ result }) => dimRow(result));
	});
}
