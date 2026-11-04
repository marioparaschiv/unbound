import * as React from 'react';

import type { AnyObject } from '../src/patcher';
import type { ReactValue } from './react-value';

/** An element's props, whatever the code under test passed. */
export type Props = AnyObject;

type Hook = {
	value?: ReactValue;
	deps?: readonly ReactValue[];
	ran?: boolean;
	cleanup?: () => void;
	reducer?: Reducer;
	dispatch?: (action: ReactValue) => void;
	subscribe?: Subscribe;
	getSnapshot?: () => ReactValue;
	stable?: (...args: ReactValue[]) => ReactValue;
};

type Reducer = (state: ReactValue, action: ReactValue) => ReactValue;

type Subscribe = (listener: () => void) => () => void;

type Frame = { root: Root; fiber: Fiber; index: number };

type Slot = { type: ReactValue; key: string };

type RenderFunction = (props: Props, ref: ReactValue) => ReactValue;

/** What a fiber renders: text, a host element, a component, or a wrapper such as a Fragment or a Provider. */
export type FiberKind = 'root' | 'text' | 'host' | 'component' | 'wrapper';

/** One rendered node, kept across renders while its type and key stay the same, so its hooks keep their state. */
export type Fiber = {
	kind: FiberKind;
	/** The element type: a host name, a function, or one of React's exotic objects. */
	type: ReactValue;
	key: string;
	name: string;
	props: Props;
	text: string;
	hooks: Hook[];
	children: Fiber[];
	parent: Fiber | undefined;
	unmounted: boolean;
	/** The instance of a class component, kept across renders as its state is. */
	instance?: ClassInstance;
};

type ClassInstance = AnyObject & {
	props: Props;
	state: AnyObject | null;
	context: ReactValue;
};

type ClassComponent = new (props: Props, context: ReactValue) => ClassInstance;

/** A mounted tree: its root fiber, and the operations a test drives it with. */
export type TestRenderer = {
	root: Fiber;
	update: (element: React.ReactNode) => void;
	unmount: () => void;
};

type Root = {
	fiber: Fiber;
	element: React.ReactNode;
	pending: boolean;
	busy: boolean;
	mounted: boolean;
	layoutEffects: (() => void)[];
	effects: (() => void)[];
	contexts: Map<object, ReactValue[]>;
};

type Exotic = { $$typeof?: symbol; type?: ReactValue; render?: ReactValue; _context?: ReactValue };

type Element = { type: ReactValue; key?: string | null; props: Props };

type Internals = { H: ReactValue };

const ELEMENT = new Set([Symbol.for('react.transitional.element'), Symbol.for('react.element')]);
const TEXT = Symbol('text');
const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');
const CONTEXT = Symbol.for('react.context');
const PROVIDER = Symbol.for('react.provider');
const CONSUMER = Symbol.for('react.consumer');
const PASS_THROUGH = new Set<ReactValue>([
	'Fragment',
	React.Fragment,
	React.StrictMode,
	React.Profiler,
	React.Suspense,
	Symbol.for('react.activity'),
]);
const MEMO_SENTINEL = Symbol.for('react.memo_cache_sentinel');
const MAX_PASSES = 50;

const internals: Internals = Reflect.get(
	React,
	'__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE',
);
const roots = new Set<Root>();
let batch = 0;
let ids = 0;
let current: Frame | undefined;

function isObject(value: ReactValue): value is AnyObject {
	return typeof value === 'object' && value !== null;
}

// A React element, or a plain `{ type, props }` from `createFakeReact`.
function isElement(value: ReactValue): value is Element {
	if (!isObject(value) || !isObject(value.props) || !('type' in value)) {
		return false;
	}

	return typeof value.$$typeof === 'symbol' ? ELEMENT.has(value.$$typeof) : true;
}

function exotic(type: ReactValue): Exotic {
	return isObject(type) ? type : {};
}

/**
 * @description Names an element type the way `findComponent` matches it: a host's name, else `displayName`, else the function's name.
 * @param type The element type.
 * @returns The name, or `''` when it has none.
 */
export function typeName(type: ReactValue): string {
	if (typeof type === 'string') {
		return type;
	}

	const named: ReactValue =
		isObject(type) || typeof type === 'function' ? Reflect.get(type, 'displayName') : void 0;

	if (typeof named === 'string') {
		return named;
	}

	if (typeof type === 'function') {
		return type.name;
	}

	const { $$typeof, type: inner, render } = exotic(type);

	if ($$typeof === MEMO) {
		return typeName(inner);
	}

	if ($$typeof === FORWARD_REF) {
		return typeName(render);
	}

	return '';
}

function newFiber(
	kind: FiberKind,
	type: ReactValue,
	key: string,
	parent: Fiber | undefined,
): Fiber {
	return {
		kind,
		type,
		key,
		name: typeName(type),
		props: {},
		text: '',
		hooks: [],
		children: [],
		parent,
		unmounted: false,
	};
}

function sameDeps(
	previous: readonly ReactValue[] | undefined,
	next: readonly ReactValue[] | undefined,
) {
	if (!previous || !next || previous.length !== next.length) {
		return false;
	}

	return previous.every((value, index) => Object.is(value, next[index]));
}

function schedule(root: Root) {
	root.pending = true;

	if (!root.busy && batch === 0 && root.mounted) {
		flush(root);
	}
}

function active() {
	if (!current) {
		throw new Error('A hook ran outside a component the test renderer is rendering.');
	}

	return current;
}

function nextHook(): Hook {
	const frame = active();
	const index = frame.index++;

	return (frame.fiber.hooks[index] ??= {});
}

function readContext(context: ReactValue): ReactValue {
	const stack = active().root.contexts.get(exotic(context));

	return stack?.length ? stack.at(-1) : Reflect.get(exotic(context), '_currentValue');
}

function useReducer(
	reducer: Reducer,
	initial: ReactValue,
	init?: (value: ReactValue) => ReactValue,
) {
	const { root, fiber } = active();
	const hook = nextHook();

	if (!hook.ran) {
		hook.ran = true;
		hook.value = init ? init(initial) : initial;
		hook.dispatch = (action) => {
			const next = hook.reducer?.(hook.value, action);

			if (fiber.unmounted || Object.is(next, hook.value)) return;

			hook.value = next;
			schedule(root);
		};
	}

	hook.reducer = reducer;

	return [hook.value, hook.dispatch];
}

function effect(queue: 'effects' | 'layoutEffects') {
	return (create: () => ReactValue, deps?: readonly ReactValue[]) => {
		const { root } = active();
		const hook = nextHook();

		if (hook.ran && deps && sameDeps(hook.deps, deps)) return;

		hook.ran = true;
		hook.deps = deps;
		root[queue].push(() => {
			hook.cleanup?.();

			const cleanup = create();

			hook.cleanup = typeof cleanup === 'function' ? () => void cleanup() : void 0;
		});
	};
}

function useMemo(factory: () => ReactValue, deps?: readonly ReactValue[]) {
	const hook = nextHook();

	if (!hook.ran || !sameDeps(hook.deps, deps)) {
		hook.ran = true;
		hook.deps = deps;
		hook.value = factory();
	}

	return hook.value;
}

function useSyncExternalStore(subscribe: Subscribe, getSnapshot: () => ReactValue) {
	const { root } = active();
	const hook = nextHook();

	hook.value = getSnapshot();
	hook.getSnapshot = getSnapshot;

	if (hook.subscribe !== subscribe) {
		hook.subscribe = subscribe;
		root.effects.push(() => {
			hook.cleanup?.();
			hook.cleanup = subscribe(() => {
				if (!Object.is(hook.getSnapshot?.(), hook.value)) {
					schedule(root);
				}
			});
		});
	}

	return hook.value;
}

const dispatcher = {
	readContext,
	useContext: readContext,
	use(usable: ReactValue) {
		if (exotic(usable).$$typeof === CONTEXT) {
			return readContext(usable);
		}

		if (isObject(usable) && usable.status === 'fulfilled') {
			return usable.value;
		}

		throw new Error(
			'The test renderer cannot suspend: use() needs a context or a settled promise.',
		);
	},
	useReducer,
	useState: (initial: ReactValue) =>
		useReducer(
			(state, action) => (typeof action === 'function' ? action(state) : action),
			initial,
			typeof initial === 'function' ? () => initial() : void 0,
		),
	useEffect: effect('effects'),
	useLayoutEffect: effect('layoutEffects'),
	useInsertionEffect: effect('layoutEffects'),
	useMemo,
	useCallback: (callback: ReactValue, deps?: readonly ReactValue[]) =>
		useMemo(() => callback, deps),
	useRef(initial: ReactValue) {
		const hook = nextHook();

		hook.value ??= { current: initial };

		return hook.value;
	},
	useImperativeHandle(ref: ReactValue, create: () => ReactValue, deps?: readonly ReactValue[]) {
		effect('layoutEffects')(() => {
			const value = create();

			if (typeof ref === 'function') {
				ref(value);

				return () => ref(null);
			}

			if (isObject(ref)) {
				ref.current = value;
			}

			return () => isObject(ref) && (ref.current = null);
		}, deps);
	},
	useSyncExternalStore,
	useId() {
		const hook = nextHook();

		hook.value ??= `«r${ids++}»`;

		return hook.value;
	},
	useMemoCache(size: number) {
		const hook = nextHook();

		hook.value ??= Array.from({ length: size }, () => MEMO_SENTINEL);

		return hook.value;
	},
	useEffectEvent(callback: (...args: ReactValue[]) => ReactValue) {
		const hook = nextHook();

		hook.value = callback;
		hook.stable ??= (...args) => (hook.value as typeof callback)(...args);

		return hook.stable;
	},
	useDebugValue: () => {},
	useDeferredValue: (value: ReactValue) => value,
	useTransition: () => [false, (callback: () => void) => callback()],
	useOptimistic: (value: ReactValue) => [value, () => {}],
	useActionState: (_action: ReactValue, initial: ReactValue) => [initial, () => {}, false],
};

function callComponent(root: Root, fiber: Fiber, render: () => ReactValue): ReactValue {
	const previous = internals.H;

	current = { root, fiber, index: 0 };
	internals.H = dispatcher;

	try {
		return render();
	} finally {
		internals.H = previous;
		current = void 0;
	}
}

// Unwraps `memo` and `forwardRef` down to the function that renders.
function renderFunction(type: ReactValue): RenderFunction | undefined {
	if (typeof type === 'function') {
		return (props) => type(props);
	}

	const { $$typeof, type: inner, render } = exotic(type);

	if ($$typeof === MEMO) {
		return renderFunction(inner);
	}

	if ($$typeof === FORWARD_REF && typeof render === 'function') {
		return (props, ref) => render(props, ref);
	}

	return undefined;
}

// Unwraps `memo` down to a class component, which `renderFunction` cannot call.
function classOf(type: ReactValue): ClassComponent | undefined {
	if (typeof type === 'function') {
		return isObject(type.prototype) && 'isReactComponent' in type.prototype
			? (type as ClassComponent)
			: undefined;
	}

	const { $$typeof, type: inner } = exotic(type);

	return $$typeof === MEMO ? classOf(inner) : undefined;
}

// Creates the instance on mount, with the `setState` and `forceUpdate` React gives it.
function mountClass(root: Root, fiber: Fiber, Class: ClassComponent, props: Props): ClassInstance {
	const { contextType } = Class as AnyObject;
	const context = contextType ? readContext(contextType) : {};
	const instance = new Class(props, context);

	instance.props = props;
	instance.context = context;
	instance.state ??= null;
	instance.setState = (partial: ReactValue, callback?: () => void) => {
		const next =
			typeof partial === 'function' ? partial(instance.state, instance.props) : partial;

		if (fiber.unmounted || next === null || next === undefined) return;

		instance.state = { ...instance.state, ...next };

		if (callback) {
			root.layoutEffects.push(callback);
		}

		schedule(root);
	};
	instance.forceUpdate = (callback?: () => void) => {
		if (fiber.unmounted) return;

		if (callback) {
			root.layoutEffects.push(callback);
		}

		schedule(root);
	};

	return instance;
}

function renderClass(root: Root, fiber: Fiber, Class: ClassComponent, props: Props): ReactValue {
	return callComponent(root, fiber, () => {
		const mounting = !fiber.instance;
		const instance = (fiber.instance ??= mountClass(root, fiber, Class, props));
		const previous = { props: instance.props, state: instance.state };
		const derive = (Class as AnyObject).getDerivedStateFromProps;

		instance.props = props;

		if (typeof derive === 'function') {
			const derived = derive(props, instance.state);

			if (derived) {
				instance.state = { ...instance.state, ...derived };
			}
		}

		const output = instance.render();

		root.layoutEffects.push(() =>
			mounting
				? instance.componentDidMount?.()
				: instance.componentDidUpdate?.(previous.props, previous.state),
		);

		return output;
	});
}

function flatten(node: ReactValue, into: ReactValue[] = []): ReactValue[] {
	if (Array.isArray(node)) {
		for (const child of node) flatten(child, into);
	} else if (node !== null && node !== undefined && typeof node !== 'boolean') {
		into.push(node);
	}

	return into;
}

function slotOf(node: ReactValue, index: number): Slot {
	if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
		return { type: TEXT, key: `#${index}` };
	}

	if (!isElement(node)) {
		throw new Error(
			`Objects are not valid as a React child (found ${Object.prototype.toString.call(node)}).`,
		);
	}

	return {
		type: node.type,
		key: node.key === null || node.key === undefined ? `#${index}` : `.${node.key}`,
	};
}

function kindOf(type: ReactValue): FiberKind {
	if (type === TEXT) {
		return 'text';
	}

	if (PASS_THROUGH.has(type)) {
		return 'wrapper';
	}

	if (typeof type === 'string') {
		return 'host';
	}

	const { $$typeof } = exotic(type);

	return $$typeof === CONTEXT || $$typeof === PROVIDER || $$typeof === CONSUMER
		? 'wrapper'
		: 'component';
}

function unmountFiber(fiber: Fiber) {
	for (const child of fiber.children) unmountFiber(child);

	fiber.unmounted = true;
	fiber.instance?.componentWillUnmount?.();

	for (const hook of fiber.hooks) hook.cleanup?.();
}

function reconcileChildren(root: Root, parent: Fiber, node: ReactValue) {
	const previous = new Map(parent.children.map((child) => [child.key, child]));

	parent.children = flatten(node).map((child, index) => {
		const { type, key } = slotOf(child, index);
		const kept = previous.get(key);
		const fiber = kept && kept.type === type ? kept : newFiber(kindOf(type), type, key, parent);

		if (kept === fiber) {
			previous.delete(key);
		}

		renderFiber(root, fiber, child);

		return fiber;
	});

	for (const stale of previous.values()) unmountFiber(stale);
}

function withContext(root: Root, context: ReactValue, value: ReactValue, render: () => void) {
	const key = exotic(context);
	const stack = root.contexts.get(key) ?? [];

	root.contexts.set(key, stack);
	stack.push(value);

	try {
		render();
	} finally {
		stack.pop();
	}
}

function renderFiber(root: Root, fiber: Fiber, node: ReactValue) {
	if (fiber.kind === 'text') {
		fiber.text = String(node);

		return;
	}

	if (!isElement(node)) return;

	const { type, props } = node;

	fiber.props = props;

	if (fiber.kind === 'host' || PASS_THROUGH.has(type)) {
		reconcileChildren(root, fiber, props.children);

		return;
	}

	const { $$typeof, _context } = exotic(type);

	if ($$typeof === CONTEXT || $$typeof === PROVIDER) {
		const context = $$typeof === CONTEXT ? type : _context;

		withContext(root, context, props.value, () =>
			reconcileChildren(root, fiber, props.children),
		);

		return;
	}

	if ($$typeof === CONSUMER) {
		const render = props.children;
		const output = callComponent(root, fiber, () =>
			typeof render === 'function' ? render(readContext(_context)) : null,
		);

		reconcileChildren(root, fiber, output);

		return;
	}

	const Class = classOf(type);

	if (Class) {
		reconcileChildren(root, fiber, renderClass(root, fiber, Class, props));

		return;
	}

	const render = renderFunction(type);

	if (!render) {
		throw new Error(`The test renderer cannot render the element type ${String(type)}.`);
	}

	reconcileChildren(
		root,
		fiber,
		callComponent(root, fiber, () => render(props, props.ref)),
	);
}

function unmountRoot(root: Root) {
	if (!root.mounted) return;

	root.mounted = false;
	roots.delete(root);
	unmountFiber(root.fiber);
	root.fiber.children = [];
}

function flush(root: Root) {
	let passes = 0;

	root.busy = true;

	try {
		while (root.pending && root.mounted) {
			if (++passes > MAX_PASSES) {
				throw new Error('Too many re-renders: a state update loops.');
			}

			root.pending = false;
			reconcileChildren(root, root.fiber, root.element);

			for (const queue of [root.layoutEffects, root.effects]) {
				for (const run of queue.splice(0)) run();
			}
		}
	} finally {
		root.busy = false;
	}
}

/**
 * @description Runs `callback` with renders held back, then renders every tree it changed once.
 * @param callback The interaction, such as a press or a store change; it may be async.
 * @returns A promise when `callback` returns one.
 */
export function act(callback: () => void): void;
export function act(callback: () => Promise<void>): Promise<void>;
export function act(callback: () => void | Promise<void>): void | Promise<void> {
	batch++;

	function done() {
		batch--;

		if (batch > 0) return;

		for (const root of roots)
			if (root.pending) {
				flush(root);
			}
	}

	let result: void | Promise<void>;

	try {
		result = callback();
	} catch (error) {
		done();
		throw error;
	}

	if (result instanceof Promise) {
		return result.finally(done);
	}

	done();
}

/**
 * @description Renders an element with React's own hooks, but no native host: host components stay plain nodes
 * a test can read. A state update renders the tree again at once, or when the enclosing {@link act} ends.
 * @param element The element to render.
 * @returns The mounted tree.
 */
export function createTestRenderer(element: React.ReactNode): TestRenderer {
	const root: Root = {
		fiber: newFiber('root', 'root', 'root', void 0),
		element,
		pending: true,
		busy: false,
		mounted: true,
		layoutEffects: [],
		effects: [],
		contexts: new Map(),
	};

	roots.add(root);
	act(() => {});

	return {
		root: root.fiber,
		update(next) {
			root.element = next;
			schedule(root);
		},
		unmount: () => unmountRoot(root),
	};
}

/**
 * @description Unmounts every tree still mounted, running their effects' cleanups.
 */
export function unmountAll(): void {
	// Deleting the entry being visited is safe while iterating a Set.
	for (const root of roots) unmountRoot(root);
}
