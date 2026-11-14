import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import { findVisibleCells } from '@unbound-plugins/shared/native/ios/visible-cells';
import type { NativeBridge, NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';

import { installStickerScale, setStickerScale, unscaleStickers } from '~/native/ios/worklets';

async function resizeRows(objc: NativeObjCBridge) {
	const cells = await findVisibleCells(objc, 'DCDMessageTableViewCell');
	const parents = await objc.batch(
		cells.map((cell) => ({ target: cell, selector: 'superview', args: [] })),
	);
	const tables = new Map<string, NativeObjectHandle>();

	for (const parent of parents) {
		const table = parent as NativeObjectHandle | null;
		const key = table ? viewKey(objc, table) : undefined;

		if (table && key !== undefined) tables.set(key, table);
	}

	await objc.batch(
		[...tables.values()].flatMap((table) => [
			{ target: table, selector: 'beginUpdates', args: [] },
			{ target: table, selector: 'endUpdates', args: [] },
		]),
	);
}

/**
 * @description Shows stickers at a chosen scale on iOS.
 * @param native The plugin's native bridge.
 * @param scale Reads the chosen factor.
 * @returns `refresh`, which applies a changed factor, and `dispose`, which removes the hooks and the scaling.
 */
export function scaleIOS({ objc, ui }: NativeBridge, scale: () => number) {
	const scope = ui.createScope();
	let queued = false;
	let disposed = false;

	ui.run(
		installStickerScale,
		scope,
		scale(),
		ui.callback(() => {
			if (queued || disposed) return;

			queued = true;
			setTimeout(() => {
				queued = false;

				if (disposed) return;

				resizeRows(objc).catch((error) => {
					if (!isCancellation(error))
						logger.error('Failed to resize rows for stickers:', error);
				});
			}, 50);
		}),
	);

	return {
		refresh() {
			ui.run(setStickerScale, scale());
		},
		dispose() {
			disposed = true;
			ui.run(unscaleStickers, scope);
			scope.dispose();
		},
	};
}
