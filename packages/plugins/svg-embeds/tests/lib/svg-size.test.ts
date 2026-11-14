import { describe, expect, test } from 'bun:test';

import { svgSize } from '~/lib/svg-size';

describe('svgSize', () => {
	test('reads pixel width and height', () => {
		expect(svgSize('<svg width="64px" height="32" viewBox="0 0 1 1">')).toEqual({
			width: 64,
			height: 32,
		});
	});

	test('falls back to the viewBox, keeping its ratio for a single side', () => {
		expect(svgSize('<svg viewBox="0 0 200 100">')).toEqual({ width: 200, height: 100 });
		expect(svgSize('<svg width="50" viewBox="0 0 200 100">')).toEqual({
			width: 50,
			height: 25,
		});
	});

	test('uses the browser default for percentages and missing sizes', () => {
		expect(svgSize('<svg width="100%" height="100%">')).toEqual({ width: 300, height: 150 });
		expect(svgSize('not svg')).toEqual({ width: 300, height: 150 });
	});
});
