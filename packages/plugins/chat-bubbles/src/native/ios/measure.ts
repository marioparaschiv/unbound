import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { MeasuredHeading } from '~/lib/cell-paint';
import type { Box } from '~/lib/geometry';
import type { createMediaCorners } from '~/native/ios/media-corners';
import type { createMentionHighlight } from '~/native/ios/mention';
import { messageLayout, type Heading, type SnapshotNode } from '~/lib/message-layout';
import { BubbleLayout, Grouping } from '~/lib/constants';
import { bubbleFrame, cardFrame } from '~/lib/geometry';
import { separateFrame } from '~/lib/group';
import { headingRoom, headingSpot, quotedCard } from '~/lib/heading';
import { textWidth } from '~/native/ios/text-width';
import { cardPadding, headingMoves } from '~/lib/style';
import { currentAppearance } from '~/lib/theme';

const SNAPSHOT = { maxDepth: 12, maxNodes: 512 };
const UNLIMITED_WIDTH = 10_000;

type MeasureParts = {
	objc: NativeObjCBridge;
	media: ReturnType<typeof createMediaCorners>;
	highlight: ReturnType<typeof createMentionHighlight>;
	/** How far Discord lays the content in from each side. */
	inset: () => number;
};

export type Measured = MeasuredHeading & {
	frame: Box;
	height: number;
	/** How far down the row a bubble may stretch to meet the next one of its group: the reactions' top in the dynamic layout, which puts them below the bubble. */
	reach: number;
	contentWidth: number;
	startsGroup: boolean;
	radius: number;
	avatar: Box;
	mediaViews: NativeObjectHandle[];
	mediaRadius: number | undefined;
	mention: Awaited<ReturnType<MeasureParts['highlight']['apply']>> | undefined;
};

/**
 * @description Measures message cells for their bubbles from a snapshot of each cell.
 * @param parts The bridge, the media and mention helpers, and the row inset.
 * @returns `measure`, which gives a cell's bubble frame, its content width and heading, or `undefined` for rows without a bubble.
 */
export function createMeasure({ objc, media, highlight, inset: readInset }: MeasureParts) {
	async function replyTextWidth(nodes: SnapshotNode[], label: number | undefined) {
		const node = label === undefined ? undefined : nodes[label];

		return node?.view ? textWidth(objc, node.view, node.frame.width) : 0;
	}

	async function drawnHeading(nodes: SnapshotNode[], heading: Heading | undefined) {
		const label = heading?.timeLabel === undefined ? undefined : nodes[heading.timeLabel];

		if (!heading?.time || !label?.view) return heading;

		const drawn = await textWidth(objc, label.view, UNLIMITED_WIDTH);

		return drawn > heading.time.width
			? { ...heading, time: { ...heading.time, width: drawn } }
			: heading;
	}

	return async function measure(cell: NativeObjectHandle): Promise<Measured | undefined> {
		const nodes = (await objc.snapshot(cell, SNAPSHOT)) as SnapshotNode[];
		const measured = messageLayout(nodes);

		if (!measured) return;

		const layout = { ...measured, heading: await drawnHeading(nodes, measured.heading) };

		const style = currentAppearance();
		const height = nodes[0]!.frame.height;
		const startsGroup = layout.headerBottom !== undefined;
		const dynamic = style.layout === BubbleLayout.dynamic;
		const { inside, quoted } = headingSpot(style, layout.heading);
		const lifted = !inside && style.roomyRows && dynamic ? style.verticalPadding : 0;
		const heading = {
			heading: layout.heading,
			bodyTop: layout.body.y,
			inside,
			quoted,
			keepTime: !dynamic,
			lifted,
			moves: headingMoves(style),
		};
		const mention = layout.highlight
			? await highlight.apply(
					nodes[layout.highlight.view]?.view,
					nodes[layout.highlight.bar]?.view,
				)
			: undefined;

		if (!dynamic) {
			return {
				...heading,
				frame: separateFrame(
					quotedCard(cardFrame(layout.column, cardPadding(style)), layout.heading, {
						quoted,
						vertical: cardPadding(style).vertical,
					}),
					height,
					style.spacing,
				),
				height,
				reach: height,
				contentWidth: layout.column.width,
				startsGroup,
				radius: style.radius,
				avatar: layout.avatar,
				mediaViews: [],
				mediaRadius: undefined,
				mention,
			};
		}

		const textView = layout.text ? nodes[layout.text.index]?.view : undefined;
		const text = textView
			? layout.text!.offset +
				(await textWidth(objc, textView, nodes[layout.text!.index]!.frame.width))
			: 0;
		// Discord already lays the content in by the inset, so the bubble's padding sits inside the body.
		const inset = readInset();
		const padding = style.horizontalPadding;
		const room =
			inside && layout.heading
				? headingRoom(
						layout.heading,
						quoted ? await replyTextWidth(nodes, layout.heading.reply?.label) : 0,
						padding,
						quoted,
					)
				: undefined;
		const body = {
			...layout.body,
			x: layout.body.x + inset,
			width: layout.body.width - inset * 2,
		};
		const contentWidth = Math.max(
			0,
			Math.max(text, layout.footerRight ?? 0, layout.labelRight ?? 0, layout.mediaRight) -
				inset,
			room ? room.minWidth - padding * 2 : 0,
		);
		const wrapped = bubbleFrame(
			body,
			contentWidth,
			{ horizontal: padding, vertical: style.verticalPadding },
			// The lift moves what the header draws, not its frame, so the snapshot still has it unlifted.
			inside || layout.headerBottom === undefined ? undefined : layout.headerBottom - lifted,
		);
		// The name sits inside, so the bubble reaches up to the padding above it.
		const top = room ? room.top - style.verticalPadding : wrapped.y;
		const frame = { ...wrapped, y: top, height: wrapped.y + wrapped.height - top };
		const fitted = await media.fit(nodes, layout, frame, style);
		const hard = layout.media && { ...layout.media, padding };
		// A joined row has little room below, so the group's last bubble hangs its padding into the next group's first row, which has room for it.
		const floor = style.grouping === Grouping.joined ? Number.POSITIVE_INFINITY : height;

		return {
			...heading,
			frame: separateFrame(fitted.frame, floor, style.spacing, hard),
			height,
			reach: Math.min(height, layout.reactionsTop ?? height),
			contentWidth,
			startsGroup,
			radius: fitted.radius,
			avatar: layout.avatar,
			mediaViews: fitted.views,
			mediaRadius: fitted.mediaRadius,
			mention,
		};
	};
}

export default { createMeasure };
