import { ActionSheets, StickerSheets } from '~/modules';
import type { Expression } from '~/expression';
import CloneSheet from '~/components/clone-sheet';

/**
 * @description Opens the sheet that clones an expression to one of the user's servers.
 * @param expression The emoji or sticker to clone.
 */
export function openCloneSheet(expression: Expression): void {
	const key = `unbound.expression-tools-sheet-clone-${Date.now()}`;

	function close() {
		ActionSheets.hideActionSheet(key);
	}

	ActionSheets.openLazy(
		Promise.resolve({ default: () => <CloneSheet expression={expression} onClose={close} /> }),
		key,
		{ onClose: close },
	);
}

/**
 * @description Closes the emoji or sticker sheet the action bar sits in.
 * @param expression The expression the sheet shows.
 * @param sheetKey The key the sheet was opened with.
 */
export function closeExpressionSheet(expression: Expression, sheetKey: string): void {
	if (expression.kind === 'sticker' && StickerSheets.hideStickerDetailActionSheet) {
		StickerSheets.hideStickerDetailActionSheet();

		return;
	}

	ActionSheets.hideActionSheet(sheetKey);
}

export default { openCloneSheet, closeExpressionSheet };
