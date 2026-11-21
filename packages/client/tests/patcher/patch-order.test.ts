import { afterEach, describe, expect, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

mockLookups({
	findByProps: () => ({ getPublicInstanceFromRootTag: () => null }),
});

const { after, unpatchAll } = await import('~/patcher/api');

afterEach(() => unpatchAll());

describe('patch order', () => {
	test('runs a patch marked last after patches added before and after it', () => {
		const target = { greet: () => 'hi' };
		const order: string[] = [];

		after(target, 'greet', () => void order.push('first'));
		after(target, 'greet', () => void order.push('last'), { last: true });
		after(target, 'greet', () => void order.push('later'));

		target.greet();

		expect(order).toEqual(['first', 'later', 'last']);
	});

	test('keeps patches marked last in the order they were added', () => {
		const target = { greet: () => 'hi' };
		const order: string[] = [];

		after(target, 'greet', () => void order.push('a'), { last: true });
		after(target, 'greet', () => void order.push('b'), { last: true });
		after(target, 'greet', () => void order.push('c'));

		target.greet();

		expect(order).toEqual(['c', 'a', 'b']);
	});
});
