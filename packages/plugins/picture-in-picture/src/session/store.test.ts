import { describe, expect, test } from 'bun:test';

import { createSessionStore } from '~/session/store';

describe('createSessionStore', () => {
	test('starts, activates and ends a session', () => {
		const store = createSessionStore<string>();

		expect(store.toggle('a')).toBe('started');
		expect(store.of('a')).toEqual({ target: 'a', phase: 'starting' });

		store.activate('a');
		expect(store.of('a')?.phase).toBe('active');

		store.end('a');
		expect(store.current()).toBeNull();
	});

	test('a second press stops the session, and a third waits for it to end', () => {
		const store = createSessionStore<string>();

		store.toggle('a');
		store.activate('a');

		expect(store.toggle('a')).toBe('stopping');
		expect(store.of('a')?.phase).toBe('stopping');
		expect(store.toggle('a')).toBe('unchanged');
	});

	test('only a starting session turns active', () => {
		const store = createSessionStore<string>();

		store.toggle('a');
		store.toggle('a');
		store.activate('a');

		expect(store.of('a')?.phase).toBe('stopping');
	});

	test('starting another video ends the current session first', () => {
		const store = createSessionStore<string>();
		const changes: [string | undefined, string | undefined][] = [];

		store.subscribe((previous, next) => changes.push([previous?.target, next?.target]));
		store.toggle('a');
		store.toggle('b');

		expect(store.of('a')).toBeNull();
		expect(store.of('b')?.phase).toBe('starting');
		expect(changes).toEqual([
			[undefined, 'a'],
			['a', undefined],
			[undefined, 'b'],
		]);
	});

	test('ignores events for a video without the session', () => {
		const store = createSessionStore<string>();

		store.toggle('a');
		store.activate('b');
		store.end('b');

		expect(store.of('a')).toEqual({ target: 'a', phase: 'starting' });
	});

	test('ending without a player ends any session, and unsubscribing stops updates', () => {
		const store = createSessionStore<string>();
		let calls = 0;
		const unsubscribe = store.subscribe(() => {
			calls += 1;
		});

		store.toggle('a');
		unsubscribe();
		store.end();

		expect(store.current()).toBeNull();
		expect(calls).toBe(1);
	});
});
