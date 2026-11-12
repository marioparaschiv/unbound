import { describe, expect, test } from 'bun:test';

import { recentErrors, recordError } from '~/diagnostics/recent-errors';

describe('recent errors', () => {
	test('keeps the newest three and names the plugin a stack points at', () => {
		const fromPlugin = new Error('undefined is not a function');

		fromPlugin.stack =
			'TypeError: undefined is not a function\n    at render (unbound-plugin/chat-bubbles.js:1:7042)';

		recordError(new Error('first'));
		recordError('second');
		recordError(new Error('third'));
		recordError(fromPlugin);

		const errors = recentErrors();

		expect(errors.map((error) => error.message)).toEqual([
			'second',
			'third',
			'undefined is not a function',
		]);
		expect(errors.at(-1)?.addon).toBe('chat-bubbles');
		expect(errors[0]?.addon).toBeUndefined();
	});
});
