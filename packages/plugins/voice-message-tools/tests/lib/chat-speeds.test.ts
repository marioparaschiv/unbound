import { describe, expect, test } from 'bun:test';

import { rememberSpeed, speedForChat } from '~/lib/chat-speeds';

describe('chat speeds', () => {
	test('uses the remembered speed for a chat, else the default', () => {
		expect(speedForChat({ a: '2' }, 'a', '1')).toBe('2');
		expect(speedForChat({ a: '2' }, 'b', '1')).toBe('1');
		expect(speedForChat({ a: '2' }, undefined, '1.5')).toBe('1.5');
	});

	test('remembers a speed and forgets one that matches the default', () => {
		expect(rememberSpeed({}, 'a', '2', '1')).toEqual({ a: '2' });
		expect(rememberSpeed({ a: '2', b: '1.5' }, 'a', '1', '1')).toEqual({ b: '1.5' });
	});
});
