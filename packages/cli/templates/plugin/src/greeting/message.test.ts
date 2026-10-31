import { describe, expect, test } from 'bun:test';

import { greetingFor } from '~/greeting/message';

describe('greetingFor', () => {
	test('greets the user by name', () => {
		expect(greetingFor({ username: 'wumpus', platform: 'iOS' })).toStartWith('Hello wumpus,');
	});

	test('greets a user without a name', () => {
		expect(greetingFor({ username: undefined, platform: 'Android' })).toStartWith(
			'Hello there,',
		);
	});
});
