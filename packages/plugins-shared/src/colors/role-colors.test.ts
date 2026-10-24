import { describe, expect, test } from 'bun:test';

import {
	colorComponentsToHex,
	getContrastingTextColor,
	getRoleColorAppearance,
	getRoleColorStops,
	getRoleGradientKey,
	parseNativeColorDescription,
	roleColorAt,
	roleColorRuns,
} from './role-colors';

const holographic = {
	primaryColor: '#112233',
	secondaryColor: '#445566',
	tertiaryColor: '#778899',
};

describe('getRoleColorStops', () => {
	test('keeps every enhanced stop in order', () => {
		expect(getRoleColorStops(holographic, '#000000')).toEqual([
			'#112233',
			'#445566',
			'#778899',
		]);
	});

	test('falls back to the plain role color', () => {
		expect(getRoleColorStops(undefined, '#123456')).toEqual(['#123456']);
		expect(getRoleColorStops(undefined, null)).toEqual([]);
	});

	test('deduplicates stops and can drop enhanced colors', () => {
		const colors = {
			primaryColor: '#123456',
			secondaryColor: '#123456',
			tertiaryColor: '#abcdef',
		};

		expect(getRoleColorStops(colors, '#000000')).toEqual(['#123456', '#abcdef']);
		expect(getRoleColorStops(colors, '#000000', false)).toEqual(['#123456']);
	});
});

describe('getRoleColorAppearance', () => {
	test('distinguishes solid, gradient and holographic roles', () => {
		expect(getRoleColorAppearance({ primaryColor: '#112233' }, '#000000').style).toBe('solid');
		expect(
			getRoleColorAppearance({ primaryColor: '#112233', secondaryColor: '#445566' }, null)
				.style,
		).toBe('gradient');
		expect(getRoleColorAppearance(holographic, undefined)).toEqual({
			colors: ['#112233', '#445566', '#778899'],
			style: 'holographic',
		});
	});

	test('treats a repeated tertiary stop as a gradient', () => {
		expect(
			getRoleColorAppearance({ ...holographic, tertiaryColor: '#112233' }, '#000000'),
		).toEqual({ colors: ['#112233', '#445566'], style: 'gradient' });
	});

	test('is solid when enhanced colors are off', () => {
		expect(getRoleColorAppearance(holographic, '#000000', false)).toEqual({
			colors: ['#112233'],
			style: 'solid',
		});
	});
});

describe('roleColorAt', () => {
	test('returns no color for invalid stops', () => {
		expect(roleColorAt([], 0.5)).toBeNull();
		expect(roleColorAt(['#12345g'], 0.5)).toBeNull();
	});

	test('preserves a solid role color', () => {
		expect(roleColorAt(['#1abc9c'], 0)).toBe('#1abc9c');
		expect(roleColorAt(['#1abc9c'], 1)).toBe('#1abc9c');
	});

	test('interpolates a two-stop gradient', () => {
		expect(roleColorAt(['#000000', '#ffffff'], 0)).toBe('#000000');
		expect(roleColorAt(['#000000', '#ffffff'], 0.5)).toBe('#808080');
		expect(roleColorAt(['#000000', '#ffffff'], 1)).toBe('#ffffff');
	});

	test('visits every holographic stop', () => {
		expect(roleColorAt(['#ff0000', '#00ff00', '#0000ff'], 0)).toBe('#ff0000');
		expect(roleColorAt(['#ff0000', '#00ff00', '#0000ff'], 0.5)).toBe('#00ff00');
		expect(roleColorAt(['#ff0000', '#00ff00', '#0000ff'], 1)).toBe('#0000ff');
	});
});

describe('roleColorRuns', () => {
	test('paints solid text as one run', () => {
		expect(roleColorRuns('@Alice', ['#1abc9c'])).toEqual([
			{ text: '@Alice', color: '#1abc9c' },
		]);
	});

	test('spreads a gradient across characters, keeping surrogate pairs whole', () => {
		expect(roleColorRuns('a😀b', ['#ff0000', '#00ff00', '#0000ff'])).toEqual([
			{ text: 'a', color: '#ff0000' },
			{ text: '😀', color: '#00ff00' },
			{ text: 'b', color: '#0000ff' },
		]);
	});

	test('paints a single character with the first stop', () => {
		expect(roleColorRuns('a', ['#ff0000', '#0000ff'])).toEqual([
			{ text: 'a', color: '#ff0000' },
		]);
	});
});

describe('native colors', () => {
	test('converts 0-1 components to hex', () => {
		expect(colorComponentsToHex(0.12549, 0.00392157, 0.980392)).toBe('#2001fa');
		expect(colorComponentsToHex(-1, 0, 0)).toBeNull();
		expect(colorComponentsToHex(Number.NaN, 0, 0)).toBeNull();
	});

	test('parses sRGB and gray UIColor descriptions', () => {
		expect(
			parseNativeColorDescription('UIExtendedSRGBColorSpace 0.141176 0.501961 0.274510 1'),
		).toEqual({ hex: '#248046', alpha: 1 });
		expect(parseNativeColorDescription('UIExtendedGrayColorSpace 0 0')).toEqual({
			hex: '#000000',
			alpha: 0,
		});
		expect(parseNativeColorDescription('UIDynamicSystemColor 0x123')).toBeNull();
	});
});

test('getRoleGradientKey ignores case and surrounding whitespace', () => {
	expect(getRoleGradientKey(' Owner ', '#ABCDEF')).toBe('owner:#abcdef');
});

test('getContrastingTextColor picks the text color readable on every stop', () => {
	expect(getContrastingTextColor(['#111111', '#222222'])).toBe('#ffffff');
	expect(getContrastingTextColor(['#eeeeee', '#ffffff'])).toBe('#000000');
	expect(getContrastingTextColor(['#111111', '#eeeeee'])).toBe('#ffffff');
});
