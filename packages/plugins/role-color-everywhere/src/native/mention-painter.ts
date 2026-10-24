import { safeCall, safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import { roleColorRuns } from '@unbound-plugins/shared/colors/role-colors';
import type { NativeObjCBridge } from '@unbound-app/api/native';

import type { NativeValue } from '~/types';

export type MentionPainter = ReturnType<typeof createMentionPainter>;

/**
 * @description Paints role-colored runs into attributed strings, caching the `UIColor` for each hex color.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns `paint` colors one mention in an attributed string, `clear` drops the color cache.
 */
export function createMentionPainter(objc: NativeObjCBridge) {
	const colors = new Map<string, NativeValue>();

	async function uiColor(hex: string): Promise<NativeValue> {
		const cached = colors.get(hex);

		const UIColor = objc.getClass('UIColor');

		if (cached || !UIColor) return cached;

		const value = Number.parseInt(hex.slice(1), 16);
		const color = await safeInvokeAsync(
			objc,
			UIColor,
			'colorWithRed:green:blue:alpha:',
			((value >> 16) & 0xff) / 255,
			((value >> 8) & 0xff) / 255,
			(value & 0xff) / 255,
			1,
		);

		if (colors.size >= 256) colors.clear();

		if (color) colors.set(hex, color);

		return color;
	}

	async function paint(
		attributed: NativeValue,
		text: string,
		location: number,
		stops: string[],
	): Promise<void> {
		let position = location;

		for (const run of roleColorRuns(text, stops)) {
			const color = await uiColor(run.color);

			if (color) {
				const range = objc.struct('NSRange', {
					location: position,
					length: run.text.length,
				});

				safeCall(objc, attributed, 'addAttribute:value:range:', 'NSColor', color, range);
			}

			position += run.text.length;
		}
	}

	return { paint, clear: () => colors.clear() };
}

export default createMentionPainter;
