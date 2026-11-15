import { describe, expect, test } from 'bun:test';

import { mock, smallCaps, upsideDown, zalgo } from '~/styles';

describe('mock', () => {
	test('alternates case over letters only', () => {
		expect(mock('hello world!')).toBe('hElLo WoRlD!');
	});
});

describe('upsideDown', () => {
	test('flips and reverses the text', () => {
		expect(upsideDown('hello!')).toBe('¡ollǝɥ');
	});
});

describe('smallCaps', () => {
	test('writes letters as small capitals', () => {
		expect(smallCaps('Hi there 2')).toBe('ʜɪ ᴛʜᴇʀᴇ 2');
	});
});

describe('zalgo', () => {
	test('adds marks after each letter and keeps spaces', () => {
		const result = zalgo('a b', 3, () => 0.99);

		expect(Array.from(result)[0]).toBe('a');
		expect(result.includes(' ')).toBe(true);
		expect(result.length).toBeGreaterThan(3);
	});

	test('stays within the message limit', () => {
		expect(zalgo('x'.repeat(1990), 6).length).toBeLessThanOrEqual(2000);
	});
});
