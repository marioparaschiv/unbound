import { describe, expect, mock, test } from 'bun:test';
import type React from 'react';

import { guardUnmountedUpdates, reportUnmountedUpdatesOnce } from '~/addons/unmounted-updates';

function reactFrom(hooks: Record<string, (...args: never[]) => void>): typeof React {
	return Object.assign(Object.create(null), hooks);
}

function fakeReact() {
	const cleanups: (() => void)[] = [];
	const setState = mock((_value: number) => undefined);
	const react = reactFrom({
		useRef: (value: boolean) => ({ current: value }),
		useEffect: (effect: () => (() => void) | void) => {
			const cleanup = effect();

			if (cleanup) {
				cleanups.push(cleanup);
			}
		},
		useCallback: <F>(callback: F) => callback,
		useState: (initial: number) => [initial, setState],
		useReducer: (_reducer: (count: number) => number, initial: number) => [initial, setState],
	});

	function unmount() {
		for (const cleanup of cleanups) cleanup();
	}

	return { react, setState, unmount };
}

describe('updates after unmount', () => {
	test('passes updates through and reports only those after unmount', () => {
		const { react, setState, unmount } = fakeReact();
		const report = mock(() => undefined);
		const guarded = guardUnmountedUpdates(react, report);
		const [state, update] = guarded.useState(1);

		expect(state).toBe(1);

		update(2);

		expect(setState).toHaveBeenCalledWith(2);
		expect(report).not.toHaveBeenCalled();

		unmount();
		update(3);

		expect(setState).toHaveBeenCalledWith(3);
		expect(report).toHaveBeenCalledTimes(1);
	});

	test('guards reducers the same way', () => {
		const { react, unmount } = fakeReact();
		const report = mock(() => undefined);
		const [, dispatch] = guardUnmountedUpdates(react, report).useReducer(
			(count: number) => count + 1,
			0,
		);

		unmount();
		dispatch();

		expect(report).toHaveBeenCalledTimes(1);
	});

	test('warns once per plugin, naming it', () => {
		const warn = mock((_message: string, _stack: string | undefined) => undefined);
		const report = reportUnmountedUpdatesOnce('Chat Bubbles', warn);

		report();
		report();

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toStartWith(
			'Chat Bubbles updated a component after it unmounted',
		);
	});
});
