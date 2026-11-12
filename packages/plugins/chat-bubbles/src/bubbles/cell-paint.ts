import type { Box } from '~/bubbles/geometry';
import type { Heading } from '~/bubbles/message-layout';
import type { CellAvatar, CellFallback, CellPaint } from '~/bubbles/ios/ui-cell';
import { headingPlace } from '~/bubbles/heading';
import { shadeColor } from '~/bubbles/shade';
import { namesInside, rowInset, type BubbleAppearance, type BubbleColor } from '~/bubbles/style';
import { BubbleLayout, Quote } from '~/constants';

/** What the measure found about a cell's heading. */
export type MeasuredHeading = {
	heading?: Heading;
	/** Where the message's text starts in the cell. */
	bodyTop: number;
	/** Whether the name and reply sit inside the bubble. */
	inside: boolean;
	/** How far the name, reply and avatar lift into the room above the bubble when they sit outside it. */
	lifted: number;
};

const lift = (amount: number) => ({ x: 0, y: amount ? -amount : 0 });

/**
 * @description Works out everything a cell shows besides its bubble: where its name, time, avatar and reply move, its quote box and the avatar by its group's last bubble.
 * @param measured The cell's heading as measured.
 * @param bubble The fitted bubble's frame in the cell.
 * @param padding The bubble's horizontal padding.
 * @param color The bubble's color, which the quote box is shaded from.
 * @param picture Whose avatar the row shows and where it sits in the group, or `undefined` to leave it to Discord.
 * @returns The cell's paint.
 */
export function cellPaint(
	measured: MeasuredHeading,
	bubble: Box,
	padding: number,
	color: BubbleColor,
	picture: CellAvatar | undefined,
): CellPaint {
	const { heading, inside, lifted } = measured;
	const extra = picture ? { picture } : {};

	if (!inside || !heading) {
		return { name: lift(lifted), avatar: lift(lifted), reply: lift(lifted), ...extra };
	}

	const place = headingPlace(heading, bubble, measured.bodyTop, padding);
	const reply = place.reply;

	return {
		name: place.name,
		avatar: place.avatar,
		reply: reply?.move ?? { x: 0, y: 0 },
		...(place.time ? { time: place.time } : {}),
		...(reply
			? {
					quote: {
						box: { ...reply.box, x: reply.box.x - bubble.x, y: reply.box.y - bubble.y },
						clip: reply.clip,
						color: { ...shadeColor(color, Quote.shade), alpha: color.alpha },
						radius: Quote.radius,
					},
				}
			: {}),
		...extra,
	};
}

/**
 * @description Works out how a first row whose message was never measured is laid out until it is.
 * @param appearance The bubble's look.
 * @returns The moves of a first row without a reply, and whether its avatar hides.
 */
export function cellFallback(appearance: BubbleAppearance): CellFallback {
	const { roomyRows, layout, verticalPadding, avatarLast } = appearance;
	const none = { x: 0, y: 0 };

	if (namesInside(appearance)) {
		return {
			name: { x: rowInset(appearance), y: 0 },
			avatar: none,
			reply: none,
			hideStart: avatarLast,
		};
	}

	const lifted = roomyRows && layout === BubbleLayout.dynamic ? verticalPadding : 0;

	return { name: lift(lifted), avatar: lift(lifted), reply: lift(lifted), hideStart: avatarLast };
}

export default { cellFallback, cellPaint };
