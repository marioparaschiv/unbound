import type { Attributes, ElementType, ReactElement, ReactNode } from 'react';

import type { Component, Decision, Fiber, FiberType } from '~/hot-refresh/refresh';
import { HOOK_FIBERS, reconcile, withAlternates } from '~/hot-refresh/refresh';
import type { RefreshType, RefreshUpdate } from '~/hot-refresh/families';
import { splicePlanned, unplanned } from '~/hot-refresh/hook-splice';
import * as Refresh from '~/hot-refresh/families';

export { register, createSignatureFunctionForTransform } from '~/hot-refresh/families';

type RefreshResult = {
	count: number;
	remounted: number;
};

type RegisterRefresh = (type: RefreshType, name: string) => void;

type CreateSignature = typeof Refresh.createSignatureFunctionForTransform;

declare global {
	var $RefreshReg$: RegisterRefresh | undefined;
	var $RefreshSig$: CreateSignature | undefined;
}

type MemoType = { $$typeof: symbol; type: RefreshType; compare: RefreshType | null };
type ForwardRefType = { $$typeof: symbol; render: RefreshType };

const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

const canonicals = new Map<string, RefreshType>();
const familyIds = new Map<FiberType, string>();
const bundleIds = new WeakMap<WeakKey, string>();

/**
 * @description Returns the value a module's component binding should hold: the same one on every run of
 * the module, so elements made from an earlier run (including Discord's) still render the latest version.
 * @template T The component or `memo` / `forwardRef` object.
 * @param value The component from this run of its module.
 * @param id The family id the refresh transform registered it under.
 * @returns The stable component for this id.
 */
export function canonical<T extends RefreshType>(value: T, id: string): T {
	const existing = canonicals.get(id);

	if (!existing) {
		const stable = isComponent(value) ? forward(id, value) : value;

		canonicals.set(id, stable);
		familyIds.set(stable, id);

		return stable as T;
	}

	if (isMemo(existing) && isMemo(value)) {
		existing.type = value.type;
		existing.compare = value.compare;
	}

	if (isForwardRef(existing) && isForwardRef(value)) {
		existing.render = value.render;
	}

	return existing as T;
}

/**
 * @description Runs a bundle built with React Fast Refresh's transform, registering its components under a scope.
 * @template T What the bundle returns.
 * @param scope Prefixes the bundle's family ids, e.g. a plugin id, so they can't clash with others.
 * @param evaluate Runs the bundle's top-level code, which calls `$RefreshReg$` and `$RefreshSig$`.
 * @returns What `evaluate` returned.
 */
export function withRefreshScope<T>(scope: string, evaluate: () => T): T {
	const { $RefreshReg$: previousRegister, $RefreshSig$: previousSignature } = globalThis;

	globalThis.$RefreshReg$ = (type, name) => {
		const id = `${scope} ${name}`;

		Refresh.register(type, id);
		bundleIds.set(type, id);
		canonical(type, id);
	};

	globalThis.$RefreshSig$ = Refresh.createSignatureFunctionForTransform;

	try {
		return evaluate();
	} finally {
		// A plugin's lazy module runs after its bundle and still calls both; outside a scope it registers nothing.
		globalThis.$RefreshReg$ = previousRegister ?? ignoreRegistration;
		globalThis.$RefreshSig$ = previousSignature ?? Refresh.createSignatureFunctionForTransform;
	}
}

function ignoreRegistration() {}

/**
 * @description Creates a React whose `createElement` swaps each component registered in {@link withRefreshScope}
 * for its stable forwarder, so elements from every run of a bundle match mounted fibers.
 * @returns Discord's React with that `createElement`.
 */
export function createScopedReact(): typeof React {
	return Object.create(React, { createElement: { value: createStableElement } });
}

function createStableElement(
	type: ElementType,
	props?: Attributes | null,
	...children: ReactNode[]
): ReactElement {
	return React.createElement(
		typeof type === 'string' ? type : stableType(type),
		props,
		...children,
	);
}

/**
 * @description Swaps a component registered by a bundle run in {@link withRefreshScope} for its stable forwarder,
 * which renders the latest version even where an earlier run's component is held (e.g. by Discord's navigator).
 * @template T The component type.
 * @param type A component, which is returned as is unless a bundle registered it.
 * @returns The stable component for a registered one, otherwise `type`.
 */
export function stableType<T extends WeakKey>(type: T): T {
	const id = bundleIds.get(type);
	const stable = id ? canonicals.get(id) : void 0;

	return stable ? (stable as T) : type;
}

/**
 * @description Applies the components registered since the last call to every mounted fiber. A component whose
 * hooks changed has its hook list spliced in place, keeping the state of the hooks it kept, or else is remounted.
 * @returns How many fibers re-rendered or remounted, and how many of them remounted.
 */
export function performRefresh(): RefreshResult {
	const update = Refresh.performReactRefresh();

	if (!update) {
		return { count: 0, remounted: 0 };
	}

	let remounted = 0;

	const count = reconcile((fiber) => {
		const decision = decide(fiber, update);

		if (decision === 'remount') {
			remounted++;
		}

		return decision;
	});

	return { count, remounted };
}

// A stable forwarder already calls its family's latest version, so it stays; any other registered
// type is replaced by the latest version. Host components (strings) are never registered.
function decide(fiber: Fiber, update: RefreshUpdate): Decision {
	const type = fiber.type && unplanned(fiber.type);

	if (!type || typeof type === 'string') return null;

	const id = familyIds.get(type);
	const family = id ? Refresh.getFamilyByID(id) : Refresh.getFamilyByType(type);

	if (!family) return null;

	const latest = id ? type : family.current;

	if (update.updatedFamilies.has(family)) {
		retype(fiber, latest);

		return 'render';
	}

	if (!update.staleFamilies.has(family)) return null;

	const plan = update.plans.get(family);

	if (plan && HOOK_FIBERS.has(fiber.tag) && typeof latest === 'function') {
		const planned = splicePlanned(fiber, latest, plan);

		if (planned) {
			retype(fiber, planned);

			return 'render';
		}
	}

	retype(fiber, latest);

	return 'remount';
}

// Only `type` changes: parents still create elements of the old type, which React matches against
// `elementType`, so the fiber is reused and renders the new function.
function retype(fiber: Fiber, type: FiberType) {
	for (const node of withAlternates([fiber])) {
		node.type = type;
	}
}

function forward(id: string, initial: Component): Component {
	function render(...args: Parameters<Component>) {
		const current = Refresh.getFamilyByID(id)?.current;
		const latest = typeof current === 'function' ? current : initial;

		return latest(...args);
	}

	Object.defineProperty(render, 'name', { value: initial.name });

	return render;
}

function isComponent(type: RefreshType): type is Component {
	return typeof type === 'function';
}

function isMemo(type: RefreshType): type is MemoType {
	return typeof type === 'object' && '$$typeof' in type && type.$$typeof === MEMO;
}

function isForwardRef(type: RefreshType): type is ForwardRefType {
	return typeof type === 'object' && '$$typeof' in type && type.$$typeof === FORWARD_REF;
}

export default { canonical, withRefreshScope, createScopedReact, stableType, performRefresh };
