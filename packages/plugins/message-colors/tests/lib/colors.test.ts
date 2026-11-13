import { describe, expect, test } from 'bun:test';

import { parseColor, toHex } from '~/lib/colors';
import { splitColors } from '~/lib/pills';

const hex = (color: number | undefined) => (color === undefined ? undefined : toHex(color));

describe('message colors', () => {
	test('reads hex, rgb and hsl colors', () => {
		expect(hex(parseColor('#FF4D6D'))).toBe('#ff4d6d');
		expect(hex(parseColor('#f0a'))).toBe('#ff00aa');
		expect(hex(parseColor('rgb(255, 77, 109)'))).toBe('#ff4d6d');
		expect(hex(parseColor('rgba(0 128 255 / 50%)'))).toBe('#0080ff');
		expect(hex(parseColor('hsl(0, 100%, 50%)'))).toBe('#ff0000');
		expect(parseColor('#zzzzzz')).toBeUndefined();
	});

	test('turns colors in text into tinted pills', () => {
		const nodes = splitColors('accent #5865F2 and rgb(255, 77, 109)!', () => 1);

		expect(nodes?.map((node) => node.type)).toEqual([
			'text',
			'mention',
			'text',
			'mention',
			'text',
		]);
		expect(nodes?.[1]).toMatchObject({
			colorString: '#5865f2',
			roleColor: 1,
			roleName: '#5865F2',
		});
	});

	test('leaves channel names, issue numbers and anchors alone', () => {
		expect(splitColors('see #general, issue #123 and a#fff', () => 1)).toBeUndefined();
	});
});
