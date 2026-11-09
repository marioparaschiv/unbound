import { describe, expect, test } from 'bun:test';

import { scrollEdges } from './scroll-edges';

describe('scrollEdges', () => {
	test('shows no fade while the content fits', () => {
		expect(scrollEdges({ offset: 0, width: 300, content: 280 })).toEqual({
			start: false,
			end: false,
		});
		expect(scrollEdges({ offset: 0, width: 300, content: 300.5 })).toEqual({
			start: false,
			end: false,
		});
	});

	test('fades only the end at the start of overflowing content', () => {
		expect(scrollEdges({ offset: 0, width: 300, content: 500 })).toEqual({
			start: false,
			end: true,
		});
	});

	test('fades both ends in the middle, and only the start at the end', () => {
		expect(scrollEdges({ offset: 100, width: 300, content: 500 })).toEqual({
			start: true,
			end: true,
		});
		expect(scrollEdges({ offset: 200, width: 300, content: 500 })).toEqual({
			start: true,
			end: false,
		});
	});
});
