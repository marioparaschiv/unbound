import {
	bubbleCorners,
	bubbleTail,
	cornerShape,
	joinFillets,
	snapRights,
	withoutTailCorner,
} from '~/bubbles/group';
import {
	BubbleStyle,
	CornerCurve,
	Grouping,
	SQUARED_CORNER_RATIO,
	TailPosition,
} from '~/constants';
import { parseHexColor, type BubbleAppearance, type BubbleColor } from '~/bubbles/style';
import { filletData, pathData } from '~/bubbles/android/path-data';
import { bubblePath, cornerRadii } from '~/bubbles/bubble-path';
import { mentionPaint } from '~/bubbles/mention-paint';

/** One sample message's bubble, at the size its content asks for. */
export type PreviewBubble = {
	start: boolean;
	end: boolean;
	own: boolean;
	mention: boolean;
	width: number;
	height: number;
};

/** How one sample bubble is drawn, in an SVG that starts `left` points before the bubble. */
export type PreviewPaint = {
	/** The bubble's width, wider than its content where it widens to a neighbour. */
	width: number;
	height: number;
	/** The room left of the bubble for its tail. */
	left: number;
	/** The SVG's width: the tail's room, the bubble, and the room right of it for joining curves. */
	svgWidth: number;
	fill: string;
	color: string;
	outline?: { path: string; color: string; width: number };
};

// Discord's mention yellow, which the real bubbles fall back to as well.
const MENTION_BAR: BubbleColor = { ...parseHexColor(BubbleStyle.mentionColor)!, alpha: 1 };

function rgba({ red, green, blue, alpha }: BubbleColor): string {
	const channel = (value: number) => Math.round(value * 255);

	return `rgba(${channel(red)}, ${channel(green)}, ${channel(blue)}, ${alpha})`;
}

// The right edges of each group's bubbles, widened like the chat does when joined bubbles smooth small steps.
function groupRights(bubbles: PreviewBubble[], style: BubbleAppearance): number[] {
	const smooth = style.grouping === Grouping.joined && style.smoothSteps;
	const rights: number[] = [];
	let run: number[] = [];

	for (const bubble of bubbles) {
		run.push(bubble.width);

		if (!bubble.end) continue;

		rights.push(...(smooth ? snapRights(run, style.radius) : run));
		run = [];
	}

	return [...rights, ...run];
}

/**
 * @description Works out how the settings preview draws its sample bubbles, with the same corners, tails, joining curves and mention colors as the chat.
 * @param bubbles The sample messages, top to bottom, with their content's size.
 * @param style The bubbles' look.
 * @returns Each bubble's paint, in the same order.
 */
export function previewPaints(bubbles: PreviewBubble[], style: BubbleAppearance): PreviewPaint[] {
	const joined = style.grouping === Grouping.joined;
	const rights = groupRights(bubbles, style);
	const left = style.tail === TailPosition.off ? 0 : style.tailSize;

	return bubbles.map((bubble, index) => {
		const { start, end, height } = bubble;
		const width = rights[index]!;
		const edges = {
			start,
			end,
			right: width,
			aboveRight: start ? undefined : rights[index - 1],
			belowRight: end ? undefined : rights[index + 1],
		};
		const corners = bubbleCorners(edges, {
			grouped: style.grouping !== Grouping.separate,
			roundExposed: style.roundExposed,
			roundOuter: style.roundOuter && !joined,
		});
		const fillets =
			joined && style.joinCurves && style.roundExposed
				? joinFillets(edges, style.radius)
				: { top: 0, bottom: 0 };
		const shape = cornerShape(
			style.radius,
			width,
			height,
			style.cornerCurve === CornerCurve.continuous,
		);
		const tail = bubbleTail(style.tail, { start, end });
		const squared = joined ? 0 : shape.radius * SQUARED_CORNER_RATIO;
		const radii = cornerRadii(withoutTailCorner(corners, tail), shape.radius, squared, tail);
		const pathTail = tail && { side: tail, size: Math.min(style.tailSize, height / 2) };
		const steps = bubblePath(width, height, radii, shape.continuous, pathTail);
		const frame = { x: left, y: 0, width, height };
		const outline = pathData(steps, frame, 1);
		const base = bubble.own ? style.ownColor : style.color;
		const painted = bubble.mention
			? mentionPaint(base, MENTION_BAR, style.mention)
			: { color: base };

		return {
			width,
			height,
			left,
			svgWidth: left + width + style.radius,
			fill: [outline, filletData(frame, fillets, 1)].filter(Boolean).join(' '),
			color: rgba(painted.color),
			...('border' in painted && painted.border.width > 0
				? {
						outline: {
							path: outline,
							color: rgba(painted.border.color),
							width: painted.border.width,
						},
					}
				: {}),
		};
	});
}

export default { previewPaints };
