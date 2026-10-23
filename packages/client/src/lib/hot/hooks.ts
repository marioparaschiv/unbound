import * as React from 'react';

import type { Fiber, Hook } from '~/lib/hot/refresh';

// UNKNOWN: a hook method takes and returns whatever the React hook it implements does.
type HookMethod = (...args: unknown[]) => unknown;

/** React's hook dispatcher: the object `React.useState` and the other hooks forward to while a component renders. */
export type Dispatcher = Record<string, HookMethod>;

/** What the current hook dispatcher means for a patch callback that calls hooks. */
export type DispatcherKind = 'idle' | 'mount' | 'update' | 'budgeted';

/** The hook objects a component holds for one patch callback, and how many it has used in this render. */
export type Budget = {
	/** How many hook objects the callback may use before new ones are inserted; `null` for no limit. */
	limit: number | null;
	used: number;
	/** Whether the callback called a hook method missing from the cost table, so `used` is wrong. */
	unknown: boolean;
	/** A re-render pass, where React reuses the hook list and nothing may be inserted. */
	strict: boolean;
};

type Frame = {
	budget: Budget;
	base: Dispatcher;
};

type Effect = {
	tag: number;
	inst: { destroy?: (() => void) | undefined };
};

type Internals = { H: Dispatcher | null };

type ReactWithInternals = typeof React & {
	__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: Internals;
};

// How many hook objects each dispatcher method adds to a component's hook list, read from React 19's source.
const HOOK_COSTS: Record<string, number> = {
	useState: 1,
	useReducer: 1,
	useMemo: 1,
	useCallback: 1,
	useRef: 1,
	useEffect: 1,
	useLayoutEffect: 1,
	useInsertionEffect: 1,
	useImperativeHandle: 1,
	useId: 1,
	useDeferredValue: 1,
	useOptimistic: 1,
	useCacheRefresh: 1,
	useEffectEvent: 1,
	useTransition: 2,
	useSyncExternalStore: 2,
	useActionState: 3,
	useFormState: 3,
	readContext: 0,
	useContext: 0,
	use: 0,
	useDebugValue: 0,
	useMemoCache: 0,
	useHostTransitionStatus: 0,
};

const internals = (React as ReactWithInternals)
	.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

const shims = new WeakMap<Dispatcher, Dispatcher>();
const bases = new WeakMap<Dispatcher, Dispatcher>();
const frames: Frame[] = [];

let mount: Dispatcher | null = null;

/** Thrown when a patch callback calls a hook its component has no slot for and none can be inserted. */
export class LateHook extends Error {
	constructor(method: string) {
		super(`${method} was called past the hooks this component holds for its patch.`);
	}
}

/**
 * @description Classifies the hook dispatcher React has installed right now.
 * @returns `idle` outside render, `mount` or `update` inside one, `budgeted` inside a budgeted patch callback.
 */
export function dispatcherKind(): DispatcherKind {
	const dispatcher = internals.H;

	if (!dispatcher || dispatcher.useState === dispatcher.useEffect) {
		return 'idle';
	}

	if (bases.has(dispatcher)) {
		return 'budgeted';
	}

	if (isMount(dispatcher)) {
		mount ??= dispatcher;

		return 'mount';
	}

	return 'update';
}

/**
 * @description Runs a patch callback with hook calls metered against its budget. Calls that fit go to React's
 * dispatcher; later ones are inserted as new hooks. Unused slots are padded once it returns or throws.
 * @template T What the callback returns.
 * @param budget The callback's budget, updated as it calls hooks.
 * @param run The callback.
 * @returns What the callback returned.
 */
export function runWithBudget<T>(budget: Budget, run: () => T): T {
	const base = internals.H;

	if (!base) {
		return run();
	}

	frames.push({ budget, base });
	internals.H = shimFor(base);

	try {
		return run();
	} finally {
		try {
			settle(budget);
		} finally {
			frames.pop();
			internals.H = base;
		}
	}
}

/**
 * @description Runs code inside a budgeted callback with React's own dispatcher, e.g. the patched original.
 * @template T What the code returns.
 * @param run The code whose hooks belong to no budget.
 * @returns What the code returned.
 */
export function runUnbudgeted<T>(run: () => T): T {
	const shim = internals.H;
	const base = shim && bases.get(shim);

	if (!shim || !base) {
		return run();
	}

	internals.H = base;

	try {
		return run();
	} finally {
		internals.H = shim;
	}
}

/**
 * @description Pads a budget's unused slots with `useRef`, which clones any kind of hook without reading it.
 * @param budget A budget whose callback is running in {@link runWithBudget}.
 */
export function settle(budget: Budget): void {
	let frame: Frame | undefined;

	for (let i = frames.length - 1; i >= 0 && !frame; i--) {
		if (frames[i].budget === budget) {
			frame = frames[i];
		}
	}

	if (!frame || budget.limit === null) return;

	while (budget.used < budget.limit) {
		frame.base.useRef();
		budget.used++;
	}
}

/**
 * @description Lists a fiber's hooks in call order.
 * @param fiber A function, forwardRef or simple memo fiber.
 * @returns Its hook objects.
 */
export function hookList(fiber: Fiber | null): Hook[] {
	const list: Hook[] = [];

	for (let hook = fiber?.memoizedState as Hook | null; hook; hook = hook.next) {
		list.push(hook);
	}

	return list;
}

/**
 * @description Removes hooks from a mounted fiber's list, running the cleanup of each removed effect.
 * @param fiber The current fiber; React rebuilds the work-in-progress list from it.
 * @param start The index of the first hook to remove.
 * @param count How many hooks to remove.
 */
export function spliceHooks(fiber: Fiber, start: number, count: number): void {
	const list = hookList(fiber);

	for (const hook of list.slice(start, start + count)) {
		destroy(hook);
	}

	const rest = list[start + count] ?? null;

	if (start === 0) {
		fiber.memoizedState = rest;
	} else {
		list[start - 1].next = rest;
	}
}

// React's mount dispatcher only sits in `H` while something mounts, so `H` records what is assigned to
// it until a mount dispatcher shows up, then becomes a plain property again.
function captureMount() {
	let value = internals.H;

	Object.defineProperty(internals, 'H', {
		configurable: true,
		enumerable: true,
		get: () => value,
		set(next: Dispatcher | null) {
			value = next;

			if (!next || !isMount(next)) return;

			mount ??= next;
			Object.defineProperty(internals, 'H', {
				value: next,
				configurable: true,
				enumerable: true,
				writable: true,
			});
		},
	});
}

function isMount(dispatcher: Dispatcher) {
	return dispatcher.useReducer?.length === 3;
}

function shimFor(base: Dispatcher) {
	const cached = shims.get(base);

	if (cached) {
		return cached;
	}

	const shim: Dispatcher = {};

	for (const method of Object.keys(base)) {
		shim[method] = forward(base, method);
	}

	shims.set(base, shim);
	bases.set(shim, base);

	return shim;
}

// Hermes shares one binding between closures made in a `for…of` body, so each method gets its own call.
function forward(base: Dispatcher, method: string): HookMethod {
	return (...args) => {
		const frame = frames[frames.length - 1];

		return frame ? consume(frame, method, args) : base[method](...args);
	};
}

// UNKNOWN: returns whatever the hook returns.
function consume(frame: Frame, method: string, args: unknown[]): unknown {
	const { budget, base } = frame;
	const cost = HOOK_COSTS[method];

	if (cost === void 0) {
		budget.unknown = true;

		return base[method](...args);
	}

	if (budget.limit === null || budget.used + cost <= budget.limit) {
		budget.used += cost;

		return base[method](...args);
	}

	if (budget.strict || !mount) {
		throw new LateHook(method);
	}

	settle(budget);
	budget.used += cost;

	// Mounting during an update appends a hook at this position; React's current-hook pointer stays
	// put, so the next update hook still clones the right one.
	return mount[method](...args);
}

function destroy(hook: Hook) {
	if (!isEffect(hook.memoizedState)) return;

	const cleanup = hook.memoizedState.inst.destroy;

	hook.memoizedState.inst.destroy = void 0;
	cleanup?.();
}

function isEffect(state: unknown): state is Effect {
	return (
		typeof state === 'object' &&
		state !== null &&
		'tag' in state &&
		'inst' in state &&
		typeof state.inst === 'object' &&
		state.inst !== null
	);
}

captureMount();

export default {
	LateHook,
	dispatcherKind,
	runWithBudget,
	runUnbudgeted,
	settle,
	hookList,
	spliceHooks,
};
