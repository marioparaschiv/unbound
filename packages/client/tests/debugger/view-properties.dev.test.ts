import { describe, expect, test } from 'bun:test';

import {
	argbToHex,
	bitNames,
	colorProperty,
	layoutSize,
	property,
	section,
	uiColorToHex,
} from '~/debugger/view-properties.dev';

describe('argbToHex', () => {
	test('moves alpha last, from a signed or unsigned int', () => {
		expect(argbToHex(0xfff2f3f5)).toBe('#F2F3F5FF');
		expect(argbToHex(-855310)).toBe('#F2F2F2FF');
		expect(argbToHex(0x80000000)).toBe('#00000080');
	});
});

describe('uiColorToHex', () => {
	test('reads RGB and gray colour spaces', () => {
		expect(uiColorToHex('UIExtendedSRGBColorSpace 1 0 0 1')).toBe('#FF0000FF');
		expect(uiColorToHex('UIExtendedGrayColorSpace 0 0.5')).toBe('#00000080');
		expect(uiColorToHex('UIDisplayP3ColorSpace 0.2 0.4 0.6 1')).toBeUndefined();
	});

	test('clamps extended components into range', () => {
		expect(uiColorToHex('UIExtendedSRGBColorSpace 1.2 -0.1 0 1')).toBe('#FF0000FF');
	});

	test('rejects other descriptions', () => {
		expect(uiColorToHex('<UIDynamicSystemColor: 0x1; name = labelColor>')).toBeUndefined();
		expect(uiColorToHex('UIExtendedSRGBColorSpace 1 0 0')).toBeUndefined();
	});
});

describe('bitNames', () => {
	const traits = { 1: 'button', 4: 'selected', 64: 'staticText' };

	test('joins the set bits and keeps unnamed ones in hex', () => {
		expect(bitNames(traits, 0)).toBe('none');
		expect(bitNames(traits, 65)).toBe('button | staticText');
		expect(bitNames(traits, 1 | 0x200)).toBe('button | 0x200');
	});
});

describe('layoutSize', () => {
	test('names the special sizes and scales the rest to dp', () => {
		expect(layoutSize(-1, 2.625)).toBe('match_parent');
		expect(layoutSize(-2, 2.625)).toBe('wrap_content');
		expect(layoutSize(105, 2.625)).toBe(40);
	});
});

describe('properties and sections', () => {
	test('keeps a unit only when given and draws a set colour as a swatch', () => {
		expect(property('alpha', 1)).toEqual({ key: 'alpha', value: 1 });
		expect(property('width', 40, 'dp')).toEqual({ key: 'width', value: 40, unit: 'dp' });
		expect(colorProperty('tint', '#5865F2FF')).toEqual({
			key: 'tint',
			value: '#5865F2FF',
			kind: 'color',
		});
		expect(colorProperty('tint', null)).toEqual({ key: 'tint', value: null });
	});

	test('drops properties the view did not report, and a section with none', () => {
		expect(section('Text', [undefined, property('lines', 1)])).toEqual({
			title: 'Text',
			properties: [{ key: 'lines', value: 1 }],
		});
		expect(section('Image', [undefined])).toBeUndefined();
	});
});
