import {
	findElement,
	getElementName,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { metro, patcher } from '@unbound-app/api';

import { expressionSheets } from '~/patches/expression-sheets';
import { parseSticker } from '~/lib/expression';
import { ActionSheets } from '~/lib/modules';

function isGuildStickerDetail(element: ElementNode): boolean {
	return getElementName(element) === 'GuildStickerDetail';
}

/**
 * @description Adds the action bar to the sticker sheet Discord opens from a message, which does not go through `openLazy`.
 */
export function patchStickerDetailActionSheet(): void {
	const StickerDetailActionSheet = metro.findByFilePath(
		'modules/stickers/native/StickerDetailActionSheet.tsx',
	);
	const sheet: unknown = StickerDetailActionSheet?.default;
	const isComponent =
		typeof sheet === 'function' || (typeof sheet === 'object' && sheet !== null);

	if (!ActionSheets || !StickerDetailActionSheet || !isComponent) {
		logger.warn(
			'Sticker detail sheet skipped: Discord moved ActionSheets or StickerDetailActionSheet.',
		);

		return;
	}

	const sheets = expressionSheets();

	patcher.react.after(StickerDetailActionSheet, 'default', ({ props, result }) => {
		const sticker = parseSticker(props) ?? parseSticker(result);
		const detail = findElement(result, isGuildStickerDetail);

		if (sticker && detail) sheets.patchDetailSheet(detail, sticker, 'StickerDetailActionSheet');
	});
}
