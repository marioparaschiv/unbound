import { describe, expect, test } from 'bun:test';

import {
	colorComponentsToHex,
	getContrastingTextColor,
	getRoleColorAppearance,
	getRoleColorStops,
	getRoleGradientKey,
	parseNativeColorDescription,
} from '@shared/role-colors';

describe('role color stops', () => {
	test('preserves enhanced gradient and three-stop colors', () => {
		expect(
			getRoleColorStops(
				{
					primaryColor: '#123456',
					secondaryColor: '#abcdef',
					tertiaryColor: '#fedcba',
				},
				'#000000',
			),
		).toEqual(['#123456', '#abcdef', '#fedcba']);
	});

	test('falls back to the effective solid member color', () => {
		expect(getRoleColorStops(undefined, '#123456')).toEqual(['#123456']);
		expect(getRoleColorStops(undefined, null)).toEqual([]);
	});

	test('deduplicates repeated stops and can disable enhanced colors', () => {
		const colors = {
			primaryColor: '#123456',
			secondaryColor: '#123456',
			tertiaryColor: '#abcdef',
		};

		expect(getRoleColorStops(colors, '#000000')).toEqual(['#123456', '#abcdef']);
		expect(getRoleColorStops(colors, '#000000', false)).toEqual(['#123456']);
	});

	test('distinguishes solid, gradient, and holographic role styles', () => {
		expect(getRoleColorAppearance({ primaryColor: '#112233' }, '#000000')).toEqual({
			colors: ['#112233'],
			style: 'solid',
		});
		expect(
			getRoleColorAppearance(
				{ primaryColor: '#112233', secondaryColor: '#445566' },
				'#000000',
			),
		).toEqual({
			colors: ['#112233', '#445566'],
			style: 'gradient',
		});
		expect(
			getRoleColorAppearance(
				{ primaryColor: '#112233', secondaryColor: '#445566', tertiaryColor: '#778899' },
				'#000000',
			),
		).toEqual({
			colors: ['#112233', '#445566', '#778899'],
			style: 'holographic',
		});
		expect(
			getRoleColorAppearance(
				{ primaryColor: '#112233', secondaryColor: '#445566', tertiaryColor: '#112233' },
				'#000000',
			),
		).toEqual({ colors: ['#112233', '#445566'], style: 'gradient' });
		expect(
			getRoleColorAppearance(
				{ primaryColor: '#112233', secondaryColor: '#445566', tertiaryColor: '#778899' },
				'#000000',
				false,
			),
		).toEqual({ colors: ['#112233'], style: 'solid' });
	});

	test('keeps enhanced role colors when the legacy member color is absent', () => {
		expect(
			getRoleColorAppearance(
				{ primaryColor: '#112233', secondaryColor: '#445566', tertiaryColor: '#778899' },
				undefined,
			),
		).toEqual({
			colors: ['#112233', '#445566', '#778899'],
			style: 'holographic',
		});
	});
});

describe('role color text contrast', () => {
	test('chooses the best readable text color across all gradient stops', () => {
		expect(getContrastingTextColor(['#111111', '#222222'])).toBe('#ffffff');
		expect(getContrastingTextColor(['#eeeeee', '#ffffff'])).toBe('#000000');
		expect(getContrastingTextColor(['#111111', '#eeeeee'])).toBe('#ffffff');
	});
});

describe('role gradient keys', () => {
	test('normalizes labels and role colors for native tag matching', () => {
		expect(getRoleGradientKey(' Owner ', '#ABCDEF')).toBe('owner:#abcdef');
	});

	test('converts native color components into role hex values', () => {
		expect(colorComponentsToHex(0.12549, 0.00392157, 0.980392)).toBe('#2001fa');
		expect(colorComponentsToHex(-1, 0, 0)).toBeNull();
	});

	test('reads native color descriptions without dereferencing CGColor pointers', () => {
		expect(
			parseNativeColorDescription('UIExtendedSRGBColorSpace 0.141176 0.501961 0.274510 1'),
		).toEqual({
			hex: '#248046',
			alpha: 1,
		});
		expect(parseNativeColorDescription('UIExtendedGrayColorSpace 0 0')).toEqual({
			hex: '#000000',
			alpha: 0,
		});
		expect(parseNativeColorDescription('UIDynamicSystemColor 0x123')).toBeNull();
	});
});
