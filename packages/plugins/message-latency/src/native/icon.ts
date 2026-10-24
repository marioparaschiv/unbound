import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';

import { currentTheme, resolveColor } from '~/theme';
import { FILL_TOKENS, Icon } from '~/constants';
import type { LatencyRecord } from '~/records';
import type { LatencyFill } from '~/latency';
import { getSubviews, setFrame } from '~/native/views';

/**
 * @description Identifies the colors an icon was drawn with, so a theme or fill change can be detected.
 * @param fill The bar colors.
 * @returns A key combining the theme and the fill.
 */
export function fillKey(fill: LatencyFill): string {
	return `${currentTheme()}:${fill.join(':')}`;
}

async function barColors(
	objc: NativeObjCBridge,
	fill: LatencyFill,
): Promise<(NativeObjectHandle | null)[]> {
	const UIColor = objc.getClass('UIColor');

	return Promise.all(
		fill.map(async (color) => {
			const hex = /^#([0-9a-f]{6})$/i.exec(resolveColor(FILL_TOKENS[color]))?.[1];

			if (!hex || !UIColor) return null;

			const value = Number.parseInt(hex, 16);

			return (await safeInvokeAsync(
				objc,
				UIColor,
				'colorWithRed:green:blue:alpha:',
				((value >> 16) & 255) / 255,
				((value >> 8) & 255) / 255,
				(value & 255) / 255,
				1,
			)) as NativeObjectHandle | null;
		}),
	);
}

/**
 * @description Sets the icon's VoiceOver label and hint from a record.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The icon from `createIcon`.
 * @param record The message's latency record.
 */
export async function describeIcon(
	objc: NativeObjCBridge,
	icon: NativeObjectHandle,
	record: LatencyRecord,
): Promise<void> {
	await safeInvokeAsync(
		objc,
		icon,
		'setAccessibilityLabel:',
		record.details.displayDelta ?? 'Old Discord Android client',
	);
	await safeInvokeAsync(objc, icon, 'setAccessibilityHint:', record.tooltip);
}

/**
 * @description Builds the three-bar signal icon as a tappable `UIButton`.
 * @param objc The Objective-C bridge from `context.native`.
 * @param record The message's latency record.
 * @returns The button, or `null` when a bar color could not be resolved.
 */
export async function createIcon(
	objc: NativeObjCBridge,
	record: LatencyRecord,
): Promise<NativeObjectHandle | null> {
	const icon = objc.alloc('UIButton');

	await safeInvokeAsync(objc, icon, 'setUserInteractionEnabled:', true);
	await safeInvokeAsync(objc, icon, 'setExclusiveTouch:', true);
	await safeInvokeAsync(objc, icon, 'setIsAccessibilityElement:', true);
	await safeInvokeAsync(objc, icon, 'setAccessibilityIdentifier:', 'message-latency');
	await describeIcon(objc, icon, record);

	const colors = await barColors(objc, record.details.fill);

	if (colors.some((color) => !color)) return null;

	for (const [index, frame] of Icon.bars.entries()) {
		const bar = objc.alloc('UIView');

		await setFrame(objc, bar, frame);
		await safeInvokeAsync(objc, bar, 'setUserInteractionEnabled:', false);
		await safeInvokeAsync(objc, bar, 'setBackgroundColor:', colors[index]);

		const layer = (await safeInvokeAsync(objc, bar, 'layer')) as NativeObjectHandle | null;

		if (layer) await safeInvokeAsync(objc, layer, 'setCornerRadius:', 0.5);

		await safeInvokeAsync(objc, icon, 'addSubview:', bar);
	}

	return icon;
}

/**
 * @description Recolors the bars of an existing icon.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The icon from `createIcon`.
 * @param fill The new bar colors.
 * @param isCurrent Whether the icon is still on screen, checked once the colors resolve.
 * @returns `true` when the bars were recolored.
 */
export async function recolorIcon(
	objc: NativeObjCBridge,
	icon: NativeObjectHandle,
	fill: LatencyFill,
	isCurrent: () => boolean,
): Promise<boolean> {
	const colors = await barColors(objc, fill);

	if (!isCurrent()) return false;

	const bars = await getSubviews(objc, icon);

	for (const [index, bar] of bars.slice(0, colors.length).entries()) {
		const color = colors[index];

		if (color) await safeInvokeAsync(objc, bar, 'setBackgroundColor:', color);
	}

	return true;
}

export default { fillKey, createIcon, recolorIcon, describeIcon };
