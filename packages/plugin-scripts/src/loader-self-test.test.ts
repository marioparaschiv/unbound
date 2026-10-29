import { expect, test } from 'bun:test';

import { withoutSelfTest } from './collect-device-matrix';
import { SELF_TEST_MARKER, judgeSelfTest } from './loader-self-test';

const attributed = new Map([['Chat Bubbles', [SELF_TEST_MARKER]]]);

test('passes when both iOS hooks fire and the error names the host', () => {
	const result = judgeSelfTest(
		{ host: 'Chat Bubbles', platform: 'ios', base: 40, derived: 3 },
		attributed,
	);

	expect(result).toEqual({
		ok: true,
		detail: 'hooks fired (base 40, subclass 3) and the error named Chat Bubbles',
	});
});

test('fails when the subclass hook is starved by its superclass hook', () => {
	expect(
		judgeSelfTest({ host: 'Chat Bubbles', platform: 'ios', base: 40, derived: 0 }, attributed)
			.ok,
	).toBe(false);
});

test('fails when the thrown error is not attributed to the host', () => {
	expect(
		judgeSelfTest(
			{ host: 'Chat Bubbles', platform: 'android', base: 12 },
			new Map([['Chat Bubbles', ['an unknown error']]]),
		).detail,
	).toBe('the thrown hook error was not logged against Chat Bubbles');
});

test('keeps self-test errors out of the host plugin results', () => {
	const errors = new Map([
		['Chat Bubbles', [SELF_TEST_MARKER]],
		['Avatar Radius', ['boom', SELF_TEST_MARKER]],
	]);

	expect([...withoutSelfTest(errors)]).toEqual([['Avatar Radius', ['boom']]]);
});
