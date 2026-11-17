import { describe, expect, test } from 'bun:test';

import { colorKey } from '~/ui/theme-editor/color-key';

describe('colorKey', () => {
	test('spells every hex form as #rrggbbaa', () => {
		expect(colorKey('#ABC')).toBe('#aabbccff');
		expect(colorKey('#abcd')).toBe('#aabbccdd');
		expect(colorKey('#1A2B3C')).toBe('#1a2b3cff');
		expect(colorKey('#1a2b3c80')).toBe('#1a2b3c80');
	});

	test('reads rgb and rgba, with a fraction or a percentage alpha', () => {
		expect(colorKey('rgb(255, 0, 16)')).toBe('#ff0010ff');
		expect(colorKey('rgba(255, 255, 255, 0.5)')).toBe('#ffffff80');
		expect(colorKey('rgb(0 0 0 / 50%)')).toBe('#00000080');
	});

	test('reads processed ARGB numbers, signed or not, and react-native-svg colours', () => {
		expect(colorKey(0xff112233)).toBe('#112233ff');
		expect(colorKey(0xff112233 | 0)).toBe('#112233ff');
		expect(colorKey({ type: 0, payload: 0x80112233 })).toBe('#11223380');
	});

	test('drops transparent colours and values that are not colours', () => {
		expect(colorKey('transparent')).toBeUndefined();
		expect(colorKey('#00000000')).toBeUndefined();
		expect(colorKey('red')).toBeUndefined();
		expect(colorKey('rgb(1, 2)')).toBeUndefined();
		expect(colorKey(undefined)).toBeUndefined();
		expect(colorKey({ payload: 'x' })).toBeUndefined();
	});
});
