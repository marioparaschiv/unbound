import { describe, expect, test } from 'bun:test';

import { rowFrame, rowPaint, type RowLayout } from '~/native/android/row-paint';
import { bubbleAppearance, type BubbleAppearance } from '~/lib/style';
import { MediaCorners } from '~/lib/constants';

const appearance = (values: Record<string, unknown> = {}): BubbleAppearance =>
	bubbleAppearance(
		(key) => ({ radius: 18, horizontalPadding: 14, verticalPadding: 8, ...values })[key],
		{ red: 0.2, green: 0.2, blue: 0.2 },
	);
const body = { x: 60, y: 20, width: 200, height: 100 };
const layout: RowLayout = {
	width: 400,
	height: 140,
	start: false,
	replyTextWidth: 0,
	body,
	contentRight: 260,
	column: body,
};
const media = { ...layout, media: { top: 20, bottom: 120, radius: 16 } };

describe('android row frame', () => {
	test('keeps its own radius beside media when media corners are off', () => {
		const fitted = rowFrame(media, appearance({ mediaCorners: MediaCorners.none }));

		expect(fitted.radius).toBe(18);
		expect(fitted.mediaRadius).toBeUndefined();
	});

	test('grows its radius by the padding around media for concentric corners', () => {
		const plain = rowFrame(media, appearance({ mediaCorners: MediaCorners.none }));
		const fitted = rowFrame(media, appearance({ mediaCorners: MediaCorners.concentric }));

		expect(fitted.radius).toBe(16 + 14);
		expect(fitted.frame).toEqual(plain.frame);
	});

	test('takes the media radius for flush corners', () => {
		expect(rowFrame(media, appearance({ mediaCorners: MediaCorners.flush })).radius).toBe(16);
	});

	test('rounds the media again to its radius less the padding, never under the minimum', () => {
		expect(
			rowFrame(media, appearance({ mediaCorners: MediaCorners.reround, radius: 30 })),
		).toMatchObject({ radius: 30, mediaRadius: 16 });
		expect(
			rowFrame(media, appearance({ mediaCorners: MediaCorners.reround })).mediaRadius,
		).toBe(4);
	});

	test('leaves media away from the bubble edges alone', () => {
		const middle = { ...layout, media: { top: 60, bottom: 80, radius: 16 } };

		expect(rowFrame(middle, appearance({ mediaCorners: MediaCorners.concentric })).radius).toBe(
			18,
		);
	});
});

describe('android row paint', () => {
	const style = appearance();
	const measured = rowFrame(layout, style);
	const fitted = { frame: measured.frame, corners: 15, fillets: { top: 0, bottom: 0 } };
	const input = {
		layout,
		measured,
		fitted,
		place: { start: true, end: true },
		style,
		color: style.color,
		scale: 2,
	};

	test('draws the bubble in pixels as one closed outline', () => {
		const paint = rowPaint(input);

		expect(paint.rowWidth).toBe(800);
		expect(paint.rowHeight).toBe(280);
		const points = [...paint.fill.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
		const xs = points.map((point) => Number(point[1]));
		const ys = points.map((point) => Number(point[2]));
		const { x, y, width, height } = fitted.frame;

		expect([Math.min(...xs), Math.max(...xs)]).toEqual([x * 2, (x + width) * 2]);
		expect([Math.min(...ys), Math.max(...ys)]).toEqual([y * 2, (y + height) * 2]);
		expect(paint.fill.match(/M/g)).toHaveLength(1);
		expect(paint.fill).toEndWith('Z');
		expect(paint.outline).toBeUndefined();
	});

	test('outlines a mention inside the bubble', () => {
		const paint = rowPaint({ ...input, mention: { red: 1, green: 0.8, blue: 0, alpha: 1 } });

		expect(paint.outline?.width).toBe(style.mention.width * 2);
		expect(paint.outline?.path).toEndWith('Z');
	});

	test('places the avatar only when it moves to the last bubble', () => {
		const avatar = { author: '1', avatarBox: { top: 10, height: 105 } };

		expect(rowPaint({ ...input, ...avatar }).picture).toBeUndefined();
		expect(
			rowPaint({ ...input, ...avatar, style: appearance({ avatarLast: true }) }).picture,
		).toEqual({
			start: true,
			end: true,
			author: '1',
			bottom: (fitted.frame.y + fitted.frame.height) * 2,
			top: 10,
			height: 105,
		});
	});

	test('scales the media radius to pixels', () => {
		const rerounded = { ...measured, mediaRadius: 4 };

		expect(rowPaint({ ...input, measured: rerounded }).mediaRadius).toBe(8);
	});
});
