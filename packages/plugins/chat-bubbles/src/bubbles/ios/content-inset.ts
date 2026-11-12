import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { PackedInset } from '~/bubbles/ios/row-padding';

const YOGA_UNIT_POINT = 1;

/**
 * @description Packs a Yoga `YGValue` (a float and its unit) into the bytes of a double. The bridge passes a number as an `NSNumber`, whose 8 bytes fill an 8-byte struct argument.
 * @param points The value in points, or `undefined` for Yoga's undefined value, which leaves the side unpadded.
 * @returns The packed value, to pass as a `YGValue` argument.
 */
export function yogaValue(points?: number): number {
	const bytes = new DataView(new ArrayBuffer(8));

	bytes.setFloat32(0, points ?? Number.NaN, true);
	bytes.setInt32(4, points === undefined ? 0 : YOGA_UNIT_POINT, true);

	return bytes.getFloat64(0, true);
}

/**
 * @description Packs the content inset for the UI thread: the content moves right by the inset and lays out narrower by both sides' worth, and its accessories sit the gap below it.
 * @param inset The inset in points; 0 leaves Discord's layout alone.
 * @param below The gap above the content's accessories, such as reactions, in points; 0 leaves them where Discord puts them.
 * @returns The packed Yoga offset, right padding and accessory margin, and Yoga's undefined value.
 */
export function packInset(inset: number, below = 0): PackedInset {
	return {
		...(inset
			? { left: yogaValue(inset), right: yogaValue(inset * 2) }
			: { left: yogaValue(), right: yogaValue() }),
		below: below ? yogaValue(below) : yogaValue(),
		none: yogaValue(),
	};
}

/**
 * @description Removes the content inset and the accessories' margin from message cells, including those waiting for reuse, which no sizing pass reaches once the hooks are gone.
 * @param objc The Objective-C bridge.
 * @param cells Every message cell in the windows.
 */
export async function removeContentInsets(objc: NativeObjCBridge, cells: NativeObjectHandle[]) {
	const unset = yogaValue();

	await Promise.all(
		cells.map((cell) =>
			objc
				.batch([
					{ target: cell, selector: 'messageContentView', args: [] },
					{ target: { $nativeBatchResult: 0 }, selector: 'yoga', args: [] },
					{ target: { $nativeBatchResult: 1 }, selector: 'setLeft:', args: [unset] },
					{
						target: { $nativeBatchResult: 1 },
						selector: 'setPaddingRight:',
						args: [unset],
					},
					{ target: { $nativeBatchResult: 0 }, selector: 'superview', args: [] },
					{ target: { $nativeBatchResult: 4 }, selector: 'subviews', args: [] },
				])
				.then(async ([content, , , , , list]) => {
					// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
					const siblings = (
						Array.isArray(list)
							? list
							: list
								? objc.array(list as NativeObjectHandle)
								: []
					) as NativeObjectHandle[];

					for (const view of siblings) {
						if (objc.call(view, 'isEqual:', content)) continue;

						const yoga = (await objc.invokeAsync(
							view,
							'yoga',
							[],
						)) as NativeObjectHandle | null;

						if (yoga) await objc.invokeAsync(yoga, 'setMarginTop:', [unset]);
					}

					await objc.invokeAsync(cell, 'setNeedsLayout', []);
				})
				.catch(() => undefined),
		),
	);
}

export default { packInset, removeContentInsets, yogaValue };
