import { afterAll, describe, expect, test } from 'bun:test';
import * as React from 'react';

import { LateHook, hookList, runWithBudget, spliceHooks } from '~/lib/hot/hooks';
import type { Budget, Dispatcher } from '~/lib/hot/hooks';
import type { Fiber, Hook } from '~/lib/hot/refresh';

import { createFiber } from './helpers/fiber';

type Internals = { H: Dispatcher | null };

type ReactWithInternals = typeof React & {
	__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: Internals;
};

const internals = (React as ReactWithInternals)
	.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

const METHODS = [
	'useState',
	'useEffect',
	'useRef',
	'useMemo',
	'useContext',
	'useTransition',
	'useActionState',
	'useFancy',
];

const calls: string[] = [];

function createDispatcher(label: string, mount: boolean): Dispatcher {
	const dispatcher: Dispatcher = {};

	for (const method of METHODS) {
		dispatcher[method] = record(label, method);
	}

	// React's mount dispatcher is the one whose useReducer takes an initializer.
	dispatcher.useReducer = mount
		? (_reducer, _initial, _init) => calls.push(`${label}:useReducer`)
		: (_reducer) => calls.push(`${label}:useReducer`);

	return dispatcher;
}

function record(label: string, method: string) {
	return () => calls.push(`${label}:${method}`);
}

function budget(limit: number | null, strict: boolean = false): Budget {
	return { limit, used: 0, unknown: false, strict };
}

function run(limit: Budget, callback: () => void) {
	calls.length = 0;
	internals.H = update;

	return runWithBudget(limit, callback);
}

const update = createDispatcher('update', false);
const mount = createDispatcher('mount', true);

afterAll(() => {
	internals.H = null;
});

describe('budget shim', () => {
	test('aborts a hook past the budget before any mount dispatcher has been seen', () => {
		expect(() => run(budget(0), () => React.useState(0))).toThrow(LateHook);
		expect(calls).toEqual([]);
	});

	test('captures the mount dispatcher from an assignment and leaves H a plain property', () => {
		internals.H = update;
		internals.H = mount;

		const descriptor = Object.getOwnPropertyDescriptor(internals, 'H');

		expect(descriptor?.writable).toBe(true);
		expect(descriptor?.value).toBe(mount);

		run(budget(0), () => React.useState(0));

		expect(calls).toEqual(['mount:useState']);
	});

	test('sends hooks within the budget to the update dispatcher and later ones to mount', () => {
		run(budget(2), () => {
			React.useState(0);
			React.useEffect(() => void 0);
			React.useState(0);
			React.useRef(null);
		});

		expect(calls).toEqual([
			'update:useState',
			'update:useEffect',
			'mount:useState',
			'mount:useRef',
		]);
	});

	test('pads the unused budget before inserting a hook that does not fit', () => {
		run(budget(1), () => void React.useTransition());

		expect(calls).toEqual(['update:useRef', 'mount:useTransition']);
	});

	test('pads a callback that returns early up to its budget', () => {
		run(budget(3), () => void React.useState(0));

		expect(calls).toEqual(['update:useState', 'update:useRef', 'update:useRef']);
	});

	test('pads a callback that throws, then restores H', () => {
		const failing = () =>
			run(budget(2), () => {
				React.useState(0);

				throw new Error('patch failed');
			});

		expect(failing).toThrow('patch failed');
		expect(calls).toEqual(['update:useState', 'update:useRef']);
		expect(internals.H).toBe(update);
	});

	test('aborts a re-render pass over budget without calling React', () => {
		const late = () =>
			run(budget(1, true), () => {
				React.useState(0);
				React.useState(0);
			});

		expect(late).toThrow(LateHook);
		expect(calls).toEqual(['update:useState']);
		expect(internals.H).toBe(update);
	});

	test('counts hook objects by the table', () => {
		const used = budget(null);

		run(used, () => {
			React.useTransition();
			React.useActionState((state: number) => state, 0);
			React.useContext(React.createContext(0));
		});

		expect(used.used).toBe(5);
		expect(used.unknown).toBe(false);
	});

	test('marks the count unknown for a method missing from the table', () => {
		const used = budget(null);

		run(used, () => internals.H?.useFancy());

		expect(used.unknown).toBe(true);
	});
});

describe('hook splice', () => {
	type Probe = { hooks: Hook[]; destroyed: number[]; fiber: Fiber };

	function createProbe(size: number): Probe {
		const destroyed: number[] = [];
		const hooks: Hook[] = [];

		for (let i = 0; i < size; i++) {
			hooks.push({ memoizedState: effect(i, destroyed), queue: null, next: null });
		}

		for (let i = 0; i < size - 1; i++) {
			hooks[i].next = hooks[i + 1];
		}

		return { hooks, destroyed, fiber: createFiber(hooks[0]) };
	}

	function effect(index: number, destroyed: number[]) {
		return { tag: 9, inst: { destroy: () => destroyed.push(index) } };
	}

	test.each([
		['head', 0, [2, 3, 4]],
		['middle', 1, [0, 3, 4]],
		['tail', 3, [0, 1, 2]],
	])('removes a %s slice, keeping the rest in order', (_name, start, kept) => {
		const { hooks, destroyed, fiber } = createProbe(5);

		spliceHooks(fiber, start, 2);

		expect(hookList(fiber)).toEqual(kept.map((index) => hooks[index]));
		expect(destroyed).toEqual([start, start + 1]);
	});

	test('runs each removed cleanup once, even when React unmounts it later', () => {
		const { hooks, destroyed, fiber } = createProbe(2);

		spliceHooks(fiber, 0, 1);

		const removed = hooks[0].memoizedState as ReturnType<typeof effect>;

		removed.inst.destroy?.();
		expect(destroyed).toEqual([0]);
	});
});
