import { describe, expect, test } from 'bun:test';

import { createHoldStore, endWindowSession } from '~/session/hold';
import { createSessionStore } from '~/session/store';

describe('createHoldStore', () => {
	test('holds a target once and releases every hold', () => {
		const holds = createHoldStore<string>();
		const heard: string[] = [];

		holds.subscribe((target) => heard.push(target));
		holds.hold('a');
		holds.hold('a');
		holds.hold('b');

		expect(holds.has('a')).toBe(true);
		expect(heard).toEqual(['a', 'b']);

		holds.releaseAll();

		expect(holds.has('a')).toBe(false);
		expect(holds.has('b')).toBe(false);
		expect(heard).toEqual(['a', 'b', 'a', 'b']);
	});
});

describe('endWindowSession', () => {
	test('a window dismissed in the background holds its player before the session ends', () => {
		const sessions = createSessionStore<string>();
		const holds = createHoldStore<string>();
		const order: string[] = [];

		sessions.toggle('a');
		holds.subscribe(() => order.push(sessions.current() ? 'held with session' : 'held late'));
		sessions.subscribe((_, next) => {
			if (!next) order.push('ended');
		});

		endWindowSession(sessions, holds, true);

		expect(sessions.current()).toBeNull();
		expect(holds.has('a')).toBe(true);
		expect(order).toEqual(['held with session', 'ended']);
	});

	test('a window expanded into the foreground only ends the session', () => {
		const sessions = createSessionStore<string>();
		const holds = createHoldStore<string>();

		sessions.toggle('a');
		endWindowSession(sessions, holds, false);

		expect(sessions.current()).toBeNull();
		expect(holds.has('a')).toBe(false);
	});

	test('nothing is held without a session', () => {
		const sessions = createSessionStore<string>();
		const holds = createHoldStore<string>();

		endWindowSession(sessions, holds, true);

		expect(holds.has('a')).toBe(false);
	});
});
