import { describe, expect, test } from 'bun:test';

import { bubbleAppearance, type BubbleAppearance } from '~/bubbles/style';
import { previewPaints, type PreviewBubble } from '~/preview/preview-paint';

const GREY = { red: 0.5, green: 0.5, blue: 0.5 };

function look(settings: Record<string, unknown>): BubbleAppearance {
	return bubbleAppearance((key) => settings[key], GREY);
}

function bubble(width: number, place: Partial<PreviewBubble> = {}): PreviewBubble {
	return { start: true, end: true, own: false, mention: false, width, height: 40, ...place };
}

const group = [
	bubble(200, { end: false }),
	bubble(190, { start: false, end: false }),
	bubble(120, { start: false }),
];

describe('previewPaints', () => {
	test('widens joined bubbles over a step smaller than the radius', () => {
		const paints = previewPaints(group, look({ grouping: 'joined', radius: 16 }));

		expect(paints.map((paint) => paint.width)).toEqual([200, 200, 120]);
	});

	test('keeps each width when smoothing is off', () => {
		const paints = previewPaints(
			group,
			look({ grouping: 'joined', radius: 16, smoothSteps: false }),
		);

		expect(paints.map((paint) => paint.width)).toEqual([200, 190, 120]);
	});

	test('curves a narrower joined bubble into the wider one above', () => {
		const [, , last] = previewPaints(group, look({ grouping: 'joined', radius: 16 }));

		expect(last!.fill.split('M')).toHaveLength(3);
	});

	test('leaves room for the tail left of the bubble', () => {
		const [paint] = previewPaints([bubble(100)], look({ tail: 'first', tailSize: 8 }));

		expect(paint!.left).toBe(8);
		expect(paint!.fill.startsWith('M')).toBe(true);
	});

	test('outlines a mention and colors your own messages', () => {
		const [mention, own] = previewPaints(
			[bubble(100, { mention: true }), bubble(100, { own: true })],
			look({ ownColor: '#ff0000', opacity: 50 }),
		);

		expect(mention!.outline?.width).toBe(0.5);
		expect(own!.color).toBe('rgba(255, 0, 0, 0.5)');
	});
});
