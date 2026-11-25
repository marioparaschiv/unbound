import { describe, expect, test } from 'bun:test';

import { scrollEdges } from '~/lib/scroll-edges';

describe('scrollEdges', () => {
	test('a row that fits hides nothing', () => {
		expect(scrollEdges({ offset: 0, width: 300, content: 300 })).toEqual({
			start: false,
			end: false,
		});
	});

	test('at the start, only the end hides chips', () => {
		expect(scrollEdges({ offset: 0, width: 300, content: 900 })).toEqual({
			start: false,
			end: true,
		});
	});

	test('in the middle, both ends hide chips', () => {
		expect(scrollEdges({ offset: 200, width: 300, content: 900 })).toEqual({
			start: true,
			end: true,
		});
	});

	test('at the end, only the start hides chips, within sub-pixel rounding', () => {
		expect(scrollEdges({ offset: 599.5, width: 300, content: 900 })).toEqual({
			start: true,
			end: false,
		});
	});
});
