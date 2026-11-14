import { describe, expect, test } from 'bun:test';

import { parsePlusReact } from '~/lib/plus-react';

describe('parsePlusReact', () => {
	test('counts the pluses before the emoji', () => {
		expect(parsePlusReact('+:fire:')).toEqual({ back: 1, name: 'fire' });
		expect(parsePlusReact('+++:thumbsup:  ')).toEqual({ back: 3, name: 'thumbsup' });
	});

	test('ignores anything that is not a plus reaction', () => {
		expect(parsePlusReact(':fire:')).toBeUndefined();
		expect(parsePlusReact('+ :fire:')).toBeUndefined();
		expect(parsePlusReact('+:fire: hello')).toBeUndefined();
	});
});
