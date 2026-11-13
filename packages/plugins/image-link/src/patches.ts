import { metro, patcher } from '@unbound-app/api';

/**
 * @description Treats no embed as a simple one, so Discord keeps the link text above an image or video it embeds.
 * Patches `hasOnlySimpleEmbed` in Discord's experiment embed utilities.
 */
export function patchSimpleEmbedCheck(): void {
	const EmbedUtils = metro.findByProps('hasOnlySimpleEmbed', 'isSingleLinkContent');

	if (typeof EmbedUtils?.hasOnlySimpleEmbed !== 'function') {
		logger.warn('Image links skipped: Discord moved hasOnlySimpleEmbed.');

		return;
	}

	patcher.instead(EmbedUtils, 'hasOnlySimpleEmbed', () => false);
}
