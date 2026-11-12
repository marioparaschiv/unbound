import type { BubbleAppearance, BubbleColor } from '~/lib/style';

/**
 * @description Colors a bubble whose message mentions the user: an outline in the mention color, and the fill tinted towards it. Free of native calls, so Android can use it too.
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

export default { mentionPaint };
