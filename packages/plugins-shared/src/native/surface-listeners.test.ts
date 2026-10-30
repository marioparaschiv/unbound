import { describe, expect, test } from 'bun:test';

import { createSurfaceListeners } from './surface-listeners';

describe('createSurfaceListeners', () => {
	test('notifies only the listeners of the surface', () => {
		const listeners = createSurfaceListeners();
		const calls: string[] = [];

		listeners.subscribe('a', () => calls.push('a1'));
		listeners.subscribe('a', () => calls.push('a2'));
		listeners.subscribe('b', () => calls.push('b'));
		listeners.notify('a');

		expect(calls).toEqual(['a1', 'a2']);
	});

	test('stops a listener once it unsubscribes', () => {
		const listeners = createSurfaceListeners();
		let calls = 0;
		const unsubscribe = listeners.subscribe('a', () => calls++);

		unsubscribe();
		listeners.notify('a');

		expect(calls).toBe(0);
	});

	test('drops every listener on clear', () => {
		const listeners = createSurfaceListeners();
		let calls = 0;

		listeners.subscribe('a', () => calls++);
		listeners.clear();
		listeners.notify('a');
		listeners.notify('unknown');

		expect(calls).toBe(0);
	});
});
