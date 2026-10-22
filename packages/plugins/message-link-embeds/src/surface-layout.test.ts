import { describe, expect, test } from 'bun:test';

import {
	BottomAnchorTracker,
	availableMessageWidthFromNative,
	bottomOffsetCorrection,
	layoutMetricsFromNative,
	readBottomAnchor,
	readSurfaceAnchor,
	SurfaceHeightCache,
	type SurfaceLayoutMetrics,
	shouldRefreshSurfaceRow,
	surfaceHeightCacheKey,
} from '@message-link-embeds/surface-layout';

describe('embedded message width', () => {
	test('uses the label position relative to the message cell', () => {
		const label = { value: { origin: { x: 68, y: 37.5 }, size: { width: 291, height: 104 } } };
		const cell = { value: { origin: { x: 0, y: 0 }, size: { width: 375, height: 143.5 } } };

		expect(availableMessageWidthFromNative(label, cell)).toBe(295);
	});

	test('keeps the label width when cell geometry is unusable', () => {
		const label = { value: { origin: { x: 68, y: 0 }, size: { width: 291, height: 50 } } };

		expect(availableMessageWidthFromNative(label, null)).toBe(291);
	});
});

function metrics(overrides: Partial<SurfaceLayoutMetrics> = {}): SurfaceLayoutMetrics {
	return {
		bottomInset: 0,
		contentHeight: 1600,
		inverted: false,
		offsetX: 0,
		offsetY: 1000,
		topInset: 0,
		viewportHeight: 600,
		...overrides,
	};
}

describe('chat bottom anchoring', () => {
	test('reads the native table geometry used for bottom anchoring', () => {
		const nativeValues = [
			{ value: { width: 320, height: 1600 } },
			{ value: { x: 4, y: 1000 } },
			{ value: { origin: { x: 0, y: 0 }, size: { width: 320, height: 600 } } },
			{ value: { a: 1, b: 0, c: 0, d: -1, tx: 0, ty: 0 } },
			{ value: { top: 12, bottom: 24 } },
		];

		expect(layoutMetricsFromNative(nativeValues)).toEqual({
			bottomInset: 24,
			contentHeight: 1600,
			inverted: true,
			offsetX: 4,
			offsetY: 1000,
			topInset: 12,
			viewportHeight: 600,
		});
	});

	test('recognizes the visible bottom of an inverted message list', () => {
		const anchor = readBottomAnchor(metrics({ inverted: true, offsetY: 0 }));

		expect(anchor.atBottom).toBe(true);
	});

	test('corrects automatic large offset changes after a row grows', () => {
		const anchor = readBottomAnchor(metrics());
		const updated = metrics({ contentHeight: 1640, offsetY: 950 });

		expect(bottomOffsetCorrection(anchor, updated, false)).toEqual({ x: 0, y: 1040 });
	});

	test('leaves the scroll position alone while the user is scrolling', () => {
		const anchor = readBottomAnchor(metrics());

		expect(
			bottomOffsetCorrection(anchor, metrics({ contentHeight: 1640 }), true),
		).toBeUndefined();
	});

	test('does not pull the user down when they were not at the bottom', () => {
		const anchor = readBottomAnchor(metrics({ offsetY: 700 }));

		expect(
			bottomOffsetCorrection(anchor, metrics({ contentHeight: 1640 }), false),
		).toBeUndefined();
	});

	test('pins a latest-message surface when reaction layout already moved the row', () => {
		const anchor = readSurfaceAnchor(metrics({ offsetY: 700 }), true);

		expect(anchor.atBottom).toBe(true);
		expect(bottomOffsetCorrection(anchor, metrics({ offsetY: 700 }), false)).toEqual({
			x: 0,
			y: 1000,
		});
	});

	test('does not pull distant history to a latest-message surface', () => {
		const anchor = readSurfaceAnchor(metrics({ offsetY: -1200 }), true);
		const inverted = readSurfaceAnchor(metrics({ inverted: true, offsetY: -1200 }), true);

		expect(anchor.atBottom).toBe(false);
		expect(inverted.atBottom).toBe(false);
		expect(bottomOffsetCorrection(anchor, metrics(), false)).toBeUndefined();
	});

	test('does not pin older message surfaces away from their current scroll position', () => {
		const anchor = readSurfaceAnchor(metrics({ offsetY: 700 }), false);

		expect(anchor.atBottom).toBe(false);
		expect(bottomOffsetCorrection(anchor, metrics({ offsetY: 700 }), false)).toBeUndefined();
	});

	test('keeps a surface anchor until the resized row publishes its new content height', () => {
		const anchor = readBottomAnchor(metrics());
		const tracker = new BottomAnchorTracker();

		tracker.capture(anchor);

		expect(tracker.correction(metrics(), false)).toBeUndefined();
		expect(tracker.correction(metrics({ contentHeight: 1640 }), false)).toEqual({
			x: 0,
			y: 1040,
		});
		expect(tracker.pending).toBe(false);
	});

	test('corrects the bottom anchor when removing a reaction shrinks the row', () => {
		const tracker = new BottomAnchorTracker();

		tracker.capture(readBottomAnchor(metrics()));

		expect(tracker.correction(metrics({ contentHeight: 1540 }), false)).toEqual({
			x: 0,
			y: 940,
		});
	});

	test('discards a pending reaction anchor when the user begins scrolling', () => {
		const tracker = new BottomAnchorTracker();

		tracker.capture(readBottomAnchor(metrics()));

		expect(tracker.correction(metrics({ contentHeight: 1640 }), true)).toBeUndefined();
		expect(tracker.pending).toBe(false);
	});
});

describe('embedded row invalidation', () => {
	test('refreshes a reattached surface even when its height did not change', () => {
		expect(shouldRefreshSurfaceRow(true, 230, 230)).toBe(true);
	});

	test('skips duplicate row invalidation when the surface height is unchanged', () => {
		expect(shouldRefreshSurfaceRow(false, 230, 230)).toBe(false);
	});
});

describe('embedded surface height cache', () => {
	test('reuses a measured height for a recycled card at the same target and width', () => {
		const cache = new SurfaceHeightCache();
		const key = surfaceHeightCacheKey('channel', 'message', 320);

		cache.set(key, 184);

		expect(cache.get(key, 72)).toBe(184);
	});

	test('keeps measurements separate when the available width changes', () => {
		const cache = new SurfaceHeightCache();
		const narrow = surfaceHeightCacheKey('channel', 'message', 320);
		const wide = surfaceHeightCacheKey('channel', 'message', 400);

		cache.set(narrow, 184);

		expect(cache.get(wide, 72)).toBe(72);
	});

	test('bounds cached measurements and evicts least recently used surfaces', () => {
		const cache = new SurfaceHeightCache(2);

		cache.set('first', 80);
		cache.set('second', 100);
		cache.get('first', 72);
		cache.set('third', 120);

		expect(cache.get('first', 72)).toBe(80);
		expect(cache.get('second', 72)).toBe(72);
		expect(cache.get('third', 72)).toBe(120);
	});
});
