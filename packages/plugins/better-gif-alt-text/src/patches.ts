import { metro, patcher } from '@unbound-app/api';
import type { MetroFunction } from '@unbound-app/api/metro';

import { gifAltText } from '~/lib/alt';

type Media = { role?: string; description?: string | null; url?: string };

type Embed = {
	type?: string;
	title?: string;
	rawTitle?: string;
	url?: string;
	thumbnail?: Media;
	image?: Media;
	video?: Media;
};

type ChatRow = { message?: { embeds?: Embed[]; attachments?: Media[] } };

function label(media: Media | undefined, url: string | undefined): void {
	if (typeof media?.role !== 'string' || media.description) return;

	const alt = gifAltText(media.role, url ?? media.url);

	if (alt) media.description = alt;
}

function labelRow(row: ChatRow | undefined): void {
	for (const embed of row?.message?.embeds ?? []) {
		for (const media of [embed.thumbnail, embed.image, embed.video]) label(media, embed.url);

		const alt = embed.thumbnail?.description;

		if (embed.type === 'gifv' && !embed.title && alt) {
			embed.title = alt;
			embed.rawTitle = alt;
		}
	}

	for (const attachment of row?.message?.attachments ?? []) label(attachment, attachment.url);
}

/**
 * @description Names each GIF in chat for screen readers by the words in its address, by patching
 * `RowManager.prototype.generate` once it loads.
 */
export function patchRowManager(): void {
	metro.onModuleLoaded(metro.filters.byName('RowManager'), (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			logger.warn('GIF labels skipped: Discord moved RowManager.prototype.generate.');

			return;
		}

		patcher.after(RowManager.prototype, 'generate', ({ result }) => labelRow(result));
	});
}
