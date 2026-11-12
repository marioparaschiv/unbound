import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { findVisibleCells } from '@unbound-plugins/shared/native/ios/visible-cells';
import { readRect } from '@unbound-plugins/shared/native/ios/rect';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';

import { frameDrift, type Box } from '~/bubbles/geometry';
import { IOSClass } from '~/constants';

const FRAME_TOLERANCE = 2;

type BubbleChecks = {
	objc: NativeObjCBridge;
	bubbles: Map<string, { cell: NativeObjectHandle; bubble: NativeObjectHandle }>;
	/** Whether a cell is waiting to be placed, so its bubble may still be missing or stale. */
	pending: (key: string) => boolean;
	isNested: (key: string, cell: NativeObjectHandle) => Promise<boolean>;
	measure: (
		cell: NativeObjectHandle,
	) => Promise<{ frame: Box; height: number; reach: number } | undefined>;
	/** The frame a cell's bubble should have now. */
	cleared: (key: string, measured: Box, height: number, stretchTo: number) => Box;
};

function describeBox({ x, y, width, height }: Box) {
	return [x, y, width, height].map((value) => Math.round(value)).join(',');
}

/**
 * @description Finds bubbles that are missing from the rows on screen, or no longer match their messages.
 * @param checks The bridge, the drawn bubbles and how the drawer measures and fits a cell.
 * @returns `missing` and `stale`, which each list one line per wrong bubble.
 */
export function createBubbleChecks({
	objc,
	bubbles,
	pending,
	isNested,
	measure,
	cleared,
}: BubbleChecks) {
	async function missing(): Promise<string[]> {
		const found: string[] = [];

		for (const cell of await findVisibleCells(objc, IOSClass.messageCell)) {
			const key = viewKey(objc, cell);

			if (key === undefined || pending(key) || (await isNested(key, cell))) continue;

			const bubble = bubbles.get(key)?.bubble;
			const shown = bubble && !(await objc.invokeAsync(bubble, 'isHidden', []));

			if (!shown && (await measure(cell).catch(() => undefined))) {
				found.push(`${key} has no bubble`);
			}
		}

		return found;
	}

	async function stale(): Promise<string[]> {
		const found: string[] = [];

		for (const [key, { cell, bubble }] of bubbles) {
			if (pending(key) || (await objc.invokeAsync(bubble, 'isHidden', []))) continue;

			const measured = await measure(cell).catch(() => undefined);

			if (!measured) continue;

			const drawn = readRect(await objc.invokeAsync(bubble, 'frame', []));
			const needed = cleared(key, measured.frame, measured.height, measured.reach);

			if (frameDrift(drawn, needed) > FRAME_TOLERANCE) {
				found.push(
					`${key} does not match its message (drawn ${describeBox(drawn)}, needed ${describeBox(needed)})`,
				);
			}
		}

		return found;
	}

	return { missing, stale };
}

export default { createBubbleChecks };
