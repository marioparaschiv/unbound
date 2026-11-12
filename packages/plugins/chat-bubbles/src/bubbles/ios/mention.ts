import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';

import type { BubbleAppearance, BubbleColor } from '~/bubbles/style';

// Discord's mention yellow, for a bar whose color does not describe as plain components.
const FALLBACK_BAR: BubbleColor = { red: 0.941, green: 0.698, blue: 0.196, alpha: 1 };

/**
 * @description Reads the components out of a `UIColor` description, such as `UIExtendedSRGBColorSpace 0.9 0.7 0.2 1`.
 * @param description The color's `description`.
 * @returns The color, or `undefined` when the description has no RGB or gray components.
 */
export function parseColorDescription(description: unknown): BubbleColor | undefined {
	if (typeof description !== 'string') return;

	const values = (description.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);

	if (description.includes('RGB') && values.length >= 4) {
		const [red, green, blue, alpha] = values as [number, number, number, number];

		return { red, green, blue, alpha };
	}

	if (description.includes('Gray') && values.length >= 2) {
		const [white, alpha] = values as [number, number];

		return { red: white, green: white, blue: white, alpha };
	}
}

/**
 * @description Colors a bubble whose message mentions the user: an outline in the mention color, and the fill tinted towards it.
 * @param bubble The bubble's color.
 * @param bar Discord's mention bar color, used when the user picked no mention color.
 * @param mention The user's mention color, if any, the outline's opacity and width, and how far the fill tints.
 * @returns The bubble's fill, which keeps the bubble's opacity, and its outline.
 */
export function mentionPaint(
	bubble: BubbleColor,
	bar: BubbleColor,
	{ color, alpha, width, tint }: BubbleAppearance['mention'],
): { color: BubbleColor; border: { color: BubbleColor; width: number } } {
	const mark = color ?? bar;
	const mix = (from: number, to: number) => from + (to - from) * tint;

	return {
		color: {
			red: mix(bubble.red, mark.red),
			green: mix(bubble.green, mark.green),
			blue: mix(bubble.blue, mark.blue),
			alpha: bubble.alpha,
		},
		border: { color: { red: mark.red, green: mark.green, blue: mark.blue, alpha }, width },
	};
}

/**
 * @description Fades out the row-wide tint Discord puts behind a message that mentions the user, so the bubble can show the mention instead.
 * @param objc The Objective-C bridge.
 * @returns `apply`, which fades a row's tint and returns its bar color, and `restore`, which shows every faded tint again.
 */
export function createMentionHighlight(objc: NativeObjCBridge) {
	const faded = new Map<string, NativeObjectHandle>();

	return {
		/**
		 * Discord hides the tint on rows without a mention, and fading uses alpha so its own hiding still shows through.
		 * @returns The bar's color when the row shows a mention, otherwise `undefined`.
		 */
		async apply(view?: NativeObjectHandle, bar?: NativeObjectHandle) {
			if (!view || !bar) return;

			const [hidden, color] = await objc.batch([
				{ target: view, selector: 'isHidden', args: [] },
				{ target: bar, selector: 'backgroundColor', args: [] },
			]);

			if (hidden || !color) return;

			const description = await objc.invokeAsync(
				color as NativeObjectHandle,
				'description',
				[],
			);
			const key = viewKey(objc, view);

			await objc.invokeAsync(view, 'setAlpha:', [0]);

			if (key !== undefined) faded.set(key, view);

			return parseColorDescription(description) ?? FALLBACK_BAR;
		},
		async restore() {
			await Promise.all(
				[...faded.values()].map((view) =>
					objc.invokeAsync(view, 'setAlpha:', [1]).catch(() => undefined),
				),
			);
			faded.clear();
		},
	};
}

export default { createMentionHighlight, mentionPaint, parseColorDescription };
