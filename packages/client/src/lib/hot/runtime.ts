import type { Attributes, ElementType, ReactElement, ReactNode } from 'react';
import type { Family, RefreshType } from 'react-refresh/runtime';
import * as Refresh from 'react-refresh/runtime';

import type { Component, FiberType } from '~/lib/hot/refresh';
import { rerender } from '~/lib/hot/refresh';

export { register, createSignatureFunctionForTransform } from 'react-refresh/runtime';

type RefreshResult = {
	count: number;
	needsRemount: boolean;
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
		globalThis.$RefreshReg$ = previousRegister;
		globalThis.$RefreshSig$ = previousSignature;
	}
}

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
 * @description Applies the components registered since the last call to every mounted fiber.
 * @returns How many fibers re-rendered, and whether a component changed its hooks and needs a remount.
 */
export function performRefresh(): RefreshResult {
	const update = Refresh.performReactRefresh();

	if (!update) {
		return { count: 0, needsRemount: false };
	}

	if (update.staleFamilies.size) {
		return { count: 0, needsRemount: true };
	}

	const count = rerender((type) => latestType(type, update.updatedFamilies));

	return { count, needsRemount: false };
}

// A stable forwarder already calls its family's latest version, so it stays; any other registered
// type is replaced by the latest version. Host components (strings) are never registered.
function latestType(type: FiberType, updated: Set<Family>): FiberType | null {
	if (typeof type === 'string') return null;

	const id = familyIds.get(type);
	const family = id ? Refresh.getFamilyByID(id) : Refresh.getFamilyByType(type);

	if (!family || !updated.has(family)) return null;

	return id ? type : family.current;
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
