import { describe, expect, test } from 'bun:test';

import { ORIGINAL, commit, cut, offsetOf } from '~/lib/hot/instances';
import type { Instance, Layout } from '~/lib/hot/instances';

import { createFiber } from './helpers/fiber';

const a = { untrackedCounts: [] };
const b = { untrackedCounts: [] };

function layout(...counts: (number | null)[]): Layout {
	return counts.map((count, index) => ({
		owner: index === 1 ? ORIGINAL : { untrackedCounts: [] },
		count,
	}));
}

function createInstance(committed: Layout): Instance {
	return { fiber: createFiber(), target: () => null, layout: committed, pending: null };
}

describe('segment offsets', () => {
	test('counts from the head when every earlier count is known', () => {
		expect(offsetOf(layout(2, 3, null), 2, 10)).toBe(5);
	});

	test('counts from the tail when the segment and every later count are known', () => {
		expect(offsetOf(layout(2, null, 1, 4), 2, 10)).toBe(5);
	});

	test('cannot place a segment with unknown counts on both sides', () => {
		expect(offsetOf(layout(null, 1, null), 1, 10)).toBeNull();
	});

	test('cannot place a segment of unknown size after an unknown one', () => {
		expect(offsetOf(layout(null, null), 1, 10)).toBeNull();
	});

	test('cuts a removed owner from either side of the unknown original', () => {
		const hooks: Layout = [
			{ owner: a, count: 2 },
			{ owner: ORIGINAL, count: null },
			{ owner: b, count: 1 },
			{ owner: a, count: 3 },
		];
		const result = cut(hooks, (owner) => owner === a, 12);

		expect(result?.slices).toEqual([
			{ start: 9, count: 3 },
			{ start: 0, count: 2 },
		]);
		expect(result?.layout.map((segment) => segment.owner)).toEqual([ORIGINAL, b]);
	});

	test('refuses a cut it cannot place', () => {
		const hooks: Layout = [
			{ owner: ORIGINAL, count: null },
			{ owner: a, count: 1 },
			{ owner: ORIGINAL, count: null },
		];

		expect(cut(hooks, (owner) => owner === a, 5)).toBeNull();
	});
});

describe('committed layout', () => {
	test('promotes the pending layout once the current hook list has its length', () => {
		const instance = createInstance(layout(0, 4));
		const next = layout(2, 4);

		instance.pending = { layout: next, length: 6 };
		commit(instance, 6);

		expect(instance.layout).toBe(next);
	});

	test('keeps the committed layout when React discarded the pending render', () => {
		const committed = layout(0, 4);
		const instance = createInstance(committed);

		instance.pending = { layout: layout(2, 4), length: 6 };
		commit(instance, 4);

		expect(instance.layout).toBe(committed);
		expect(instance.pending).toBeNull();
	});
});
