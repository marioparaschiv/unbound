import { flux, metro, patcher } from '@unbound-app/api';
import type { MetroFunction } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';

import { placeholderLightness } from '~/lib/brightness';
import { isNightHour } from '~/lib/schedule';

type Attachment = { attachmentType?: string; placeholder?: string | null };

type ChatRowMessage = { attachments?: Attachment[] | null; attachmentsOpacity?: number | null };

type ChatRow = { message?: ChatRowMessage };

type ThemeStore = { theme?: string };

const DIMMED_TYPES = new Set(['image', 'video']);

function isActive(): boolean {
	if (settings.when === 'always') return true;

	if (settings.when === 'night') {
		return isNightHour(new Date().getHours(), settings.nightStart, settings.nightEnd);
	}

	return (flux.getStore('Theme') as unknown as ThemeStore).theme !== 'light';
}

function isBright(attachment: Attachment): boolean {
	if (!DIMMED_TYPES.has(attachment.attachmentType ?? '') || !attachment.placeholder) return false;

	return (placeholderLightness(attachment.placeholder) ?? 0) >= settings.brightness / 100;
}

function dimRow(row: ChatRow | undefined): void {
	const message = row?.message;

	if (!message?.attachments?.some(isBright) || !isActive()) return;

	message.attachmentsOpacity = Math.min(message.attachmentsOpacity ?? 1, 1 - settings.dim / 100);
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
