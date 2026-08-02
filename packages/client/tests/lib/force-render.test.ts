import { describe, expect, test, beforeEach } from 'bun:test';
import type { JSX } from 'react';
import * as React from 'react';

// The unit reads React's private dispatcher slot, which is `null` outside a render pass. Install a
// sentinel object there so every key it swaps has a distinguishable original to restore.
type Dispatcher = Record<string, unknown>;
type ReactInternals = { H: Dispatcher | null };
type ReactWithInternals = typeof React & {
	__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactInternals;
};

const internals = (React as ReactWithInternals)
	.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

const overriddenKeys = [
	'useMemo',
	'useState',
	'useReducer',
	'useEffect',
	'useInsertionEffect',
	'useDeferredValue',
	'useLayoutEffect',
	'useRef',
	'useCallback',
	'useImperativeHandle',
	'useTransition',
	'useSyncExternalStore',
	'useContext',
] as const;

/** A sentinel per key, distinguishable by identity, so restoration can be asserted exactly. */
function makeSentinelDispatcher(): Dispatcher {
	const dispatcher: Dispatcher = { untouchedKey: () => 'sentinel-untouched' };
	for (const key of overriddenKeys) dispatcher[key] = () => key;

	return dispatcher;
}

let dispatcher: Dispatcher;

beforeEach(() => {
	dispatcher = makeSentinelDispatcher();
	internals.H = dispatcher;
});

const forceRender = (await import('~/lib/force-render')).default;

// The unit is typed against JSX.Element but never inspects the return value, so tests return a
// plain marker object through the one cast-free boundary a helper gives.
const element = (value: unknown) => value as JSX.Element;

/** Renders a component whose only job is to report the `this` forceRender bound to it. */
function renderReportingThis(context: unknown): unknown {
	let observed: unknown = 'unbound';

	forceRender(function reportThis(this: unknown) {
		observed = this;

		return element(null);
	}, context)();

	return observed;
}

/** Reads a hook off the live dispatcher, which is what a component sees mid-render. */
function hook<T>(name: string): T {
	return dispatcher[name] as T;
}

describe('forceRender invocation', () => {
	test('returns a function that has not yet invoked the component', () => {
		let calls = 0;
		const rendered = forceRender(() => {
			calls++;

			return element({ type: 'div' });
		});

		expect(typeof rendered).toBe('function');
		expect(calls).toBe(0);
	});

	test('invoking calls the component once and returns its value with args forwarded', () => {
		const seen: unknown[][] = [];
		const output = element({ type: 'output' });
		const rendered = forceRender((name: string, count: number) => {
			seen.push([name, count]);

			return output;
		});

		expect(rendered('alpha', 7)).toBe(output);
		expect(seen).toEqual([['alpha', 7]]);
	});

	test('a truthy context becomes `this` inside the component', () => {
		const context = { label: 'ctx' };

		expect(renderReportingThis(context)).toBe(context);
	});

	test('MUTATION PROBE: a falsy-but-valid context is dropped and the component gets no `this`', () => {
		// The branch tests `context ?` rather than `context !== undefined`, so `0` and `''` fall to
		// the no-context call. A caller passing either should still have it bound as `this`.
		for (const context of [0, '']) {
			expect(renderReportingThis(context)).not.toBe(context);
		}
	});
});

describe('hook overrides seen from inside a component', () => {
	test('useMemo runs its factory on every call and ignores memoisation', () => {
		let factoryRuns = 0;
		const results: unknown[] = [];

		forceRender(() => {
			const useMemo = hook<(factory: () => unknown, deps: unknown[]) => unknown>('useMemo');

			results.push(useMemo(() => ++factoryRuns, []));
			results.push(useMemo(() => ++factoryRuns, []));

			return element(null);
		})();

		expect(results).toEqual([1, 2]);
		expect(factoryRuns).toBe(2);
	});

	test('useState returns the initial value with a setter that does nothing', () => {
		let pair: readonly [unknown, (value: unknown) => unknown] | undefined;

		forceRender(() => {
			const useState =
				hook<(state: unknown) => readonly [unknown, (value: unknown) => unknown]>(
					'useState',
				);
			pair = useState({ count: 3 });

			return element(null);
		})();

		expect(pair?.[0]).toEqual({ count: 3 });
		expect(typeof pair?.[1]).toBe('function');
		expect(pair?.[1]('ignored')).toBeUndefined();
	});

	test('useReducer returns the passed state, not a reducer-derived one', () => {
		let pair: readonly [unknown, () => unknown] | undefined;

		forceRender(() => {
			const useReducer =
				hook<(reducer: unknown, state: unknown) => readonly [unknown, () => unknown]>(
					'useReducer',
				);
			// The override takes the *first* argument as state, so the reducer slot is what surfaces.
			pair = useReducer('reducer-slot', 'state-slot');

			return element(null);
		})();

		expect(pair?.[0]).toBe('reducer-slot');
		expect(pair?.[1]()).toBeUndefined();
	});

	test('the effect hooks return undefined and never run their callbacks', () => {
		const effectNames = [
			'useEffect',
			'useInsertionEffect',
			'useLayoutEffect',
			'useImperativeHandle',
		];
		let ran = 0;
		const returns: unknown[] = [];

		forceRender(() => {
			for (const name of effectNames) {
				const useEffectLike =
					hook<(callback: () => void, deps: unknown[]) => unknown>(name);
				returns.push(useEffectLike(() => void ran++, []));
			}

			return element(null);
		})();

		expect(returns).toEqual([undefined, undefined, undefined, undefined]);
		expect(ran).toBe(0);
	});

	test('useDeferredValue yields the value unchanged', () => {
		const value = { deferred: true };
		let deferred: unknown;

		forceRender(() => {
			const useDeferredValue = hook<(value: unknown) => unknown>('useDeferredValue');
			deferred = useDeferredValue(value);

			return element(null);
		})();

		expect(deferred).toBe(value);
	});

	test('MUTATION PROBE: useRef ignores its initial value and hands back a fresh object per call', () => {
		// The override is `() => ({ current: null })`, so the initial value is discarded and the
		// identity a component relies on across reads is not stable within a single render.
		let first: unknown;
		let second: unknown;

		forceRender(() => {
			const useRef = hook<(initial: unknown) => { current: unknown }>('useRef');
			first = useRef('initial');
			second = useRef('initial');

			return element(null);
		})();

		expect(first).toEqual({ current: null });
		expect(second).toEqual({ current: null });
		expect(first).not.toBe(second);
	});

	test('useCallback returns the identical callback it was given', () => {
		const callback = () => 'called';
		let returned: unknown;

		forceRender(() => {
			const useCallback =
				hook<(callback: unknown, deps: unknown[]) => unknown>('useCallback');
			returned = useCallback(callback, []);

			return element(null);
		})();

		expect(returned).toBe(callback);
	});

	test('useTransition reports a non-pending transition with a noop starter', () => {
		let pair: readonly [boolean, (scope: () => void) => unknown] | undefined;
		let scopeRuns = 0;

		forceRender(() => {
			const useTransition =
				hook<() => readonly [boolean, (scope: () => void) => unknown]>('useTransition');
			pair = useTransition();

			return element(null);
		})();

		expect(pair?.[0]).toBe(false);
		expect(pair?.[1](() => void scopeRuns++)).toBeUndefined();
		expect(scopeRuns).toBe(0);
	});

	test('useSyncExternalStore reads getSnapshot and never subscribes', () => {
		let subscribes = 0;
		let snapshot: unknown;

		forceRender(() => {
			const useSyncExternalStore =
				hook<(subscribe: (fn: () => void) => void, getSnapshot: () => unknown) => unknown>(
					'useSyncExternalStore',
				);
			snapshot = useSyncExternalStore(
				() => void subscribes++,
				() => ({ store: 'value' }),
			);

			return element(null);
		})();

		expect(snapshot).toEqual({ store: 'value' });
		expect(subscribes).toBe(0);
	});

	test('useContext reads _currentValue off the context object', () => {
		let read: unknown;

		forceRender(() => {
			const useContext = hook<(context: { _currentValue: unknown }) => unknown>('useContext');
			read = useContext({ _currentValue: 'provided' });

			return element(null);
		})();

		expect(read).toBe('provided');
	});
});

describe('dispatcher restoration', () => {
	test('every overridden key is restored by identity on a normal return', () => {
		const before = Object.fromEntries(overriddenKeys.map((key) => [key, dispatcher[key]]));

		forceRender(() => element(null))();

		for (const key of overriddenKeys) expect(dispatcher[key]).toBe(before[key]);
	});

	test('a key not in the override set is left alone', () => {
		const untouched = dispatcher.untouchedKey;
		let duringRender: unknown;

		forceRender(() => {
			duringRender = dispatcher.untouchedKey;

			return element(null);
		})();

		expect(duringRender).toBe(untouched);
		expect(dispatcher.untouchedKey).toBe(untouched);
	});

	test('a throwing component propagates its error and still restores the dispatcher', () => {
		const before = Object.fromEntries(overriddenKeys.map((key) => [key, dispatcher[key]]));

		const rendered = forceRender((): JSX.Element => {
			throw new Error('component blew up');
		});

		expect(() => rendered()).toThrow('component blew up');
		for (const key of overriddenKeys) expect(dispatcher[key]).toBe(before[key]);
	});

	test('the overrides are installed for the duration of the call only', () => {
		const outside = dispatcher.useMemo;
		let inside: unknown;

		forceRender(() => {
			inside = dispatcher.useMemo;

			return element(null);
		})();

		expect(inside).not.toBe(outside);
		expect(dispatcher.useMemo).toBe(outside);
	});

	test('a nested forceRender leaves the dispatcher fully restored after the outer returns', () => {
		const before = Object.fromEntries(overriddenKeys.map((key) => [key, dispatcher[key]]));
		let innerSawOverride = false;
		let outerAfterInner: unknown;

		forceRender(() => {
			forceRender(() => {
				innerSawOverride = dispatcher.useMemo !== before.useMemo;

				return element(null);
			})();

			outerAfterInner = dispatcher.useMemo;

			return element(null);
		})();

		expect(innerSawOverride).toBe(true);
		// The inner call snapshots the outer's overrides, so the outer still has them afterwards.
		expect(outerAfterInner).not.toBe(before.useMemo);
		for (const key of overriddenKeys) expect(dispatcher[key]).toBe(before[key]);
	});
});
