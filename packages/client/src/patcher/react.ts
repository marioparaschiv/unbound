import type { PatchCallback, PatchContext, PatchOptions, PatchParent } from 'possess';
import type { JSXElementConstructor, ReactNode } from 'react';
import noop from '@unbound-app/utils/noop';
import { PatchType } from 'possess';

import { recordFailure, recordSuccess, type PatchFailures } from '~/patcher/patch-failures';
import { fallbackOf, isPatchBoundary, withPatchBoundary } from '~/patcher/patch-boundary';
import { isolateAdded, markDiscordTree } from '~/patcher/isolate-added';
import type { PatchBoundaryProps } from '~/patcher/patch-boundary';
import { snapshotTree } from '~/patcher/snapshot-tree';
import type { IsUntyped } from '~/patcher/is-untyped';
import { LateHook } from '~/hot-refresh/hooks';

/** A component `patcher.react` finds the render of by itself: a `memo`, a `forwardRef` or a class. */
export type ReactPatchTarget = JSXElementConstructor<never> | { $$typeof: symbol };

/** The props component `C` renders with. */
export type ReactPropsOf<C> =
	IsUntyped<C> extends true
		? C
		: C extends JSXElementConstructor<infer P>
			? P
			: C extends { type: infer Inner }
				? ReactPropsOf<Inner>
				: C extends { render: (props: infer P, ...rest: never[]) => ReactNode }
					? P
					: never;

/** The `this` component `C` renders with: a class component's instance, else `undefined`. */
export type ReactSelfOf<C> =
	IsUntyped<C> extends true
		? C
		: C extends abstract new (...args: never[]) => infer Instance
			? Instance
			: C extends { type: infer Inner }
				? ReactSelfOf<Inner>
				: undefined;

/**
 * The context a `patcher.react` callback receives.
 * @template P The component's props.
 * @template Self The class instance rendering, or `undefined` for a function component.
 */
export type ReactBeforeContext<P, Self> = {
	/** The props of this render. */
	props: P;
	/** The class instance rendering, or `undefined` for a function component. */
	this: Self;
	/** Renders the unpatched component; a class component ignores `props`. */
	original: (props?: P) => ReactNode;
};

/**
 * The context an `instead` callback of `patcher.react` receives.
 * @template P The component's props.
 * @template Self The class instance rendering, or `undefined` for a function component.
 */
export type ReactInsteadContext<P, Self> = ReactBeforeContext<P, Self>;

/**
 * The context an `after` callback of `patcher.react` receives, with the rendered tree.
 * @template P The component's props.
 * @template Self The class instance rendering, or `undefined` for a function component.
 */
export type ReactAfterContext<P, Self> = ReactBeforeContext<P, Self> & {
	/** What the component rendered, after earlier patches. */
	result: ReactNode;
};

/**
 * A `before` callback, which can replace a function component's props by returning new ones.
 * @template P The component's props.
 * @template Self The class instance rendering, or `undefined` for a function component.
 */
export type ReactBeforeCallback<P, Self> = (ctx: ReactBeforeContext<P, Self>) => P | void;

/**
 * An `instead` callback, whose return value is rendered in place of the component.
 * @template P The component's props.
 * @template Self The class instance rendering, or `undefined` for a function component.
 */
export type ReactInsteadCallback<P, Self> = (ctx: ReactInsteadContext<P, Self>) => ReactNode;

/**
 * An `after` callback, whose return value replaces the rendered tree unless it is `undefined`.
 * @template P The component's props.
 * @template Self The class instance rendering, or `undefined` for a function component.
 */
export type ReactAfterCallback<P, Self> = (ctx: ReactAfterContext<P, Self>) => ReactNode;

/** One `patcher.react` hook: takes a `memo`, `forwardRef` or class component, or the object and key holding any component. */
export type ReactPatch<Kind extends PatchType> = {
	<C extends ReactPatchTarget>(
		component: C,
		callback: ReactCallbackOf<Kind, ReactPropsOf<C>, ReactSelfOf<C>>,
		options?: PatchOptions,
	): () => void;
	<M extends PatchParent, K extends Extract<keyof M, string>>(
		parent: M,
		key: K,
		callback: ReactCallbackOf<Kind, ReactPropsOf<M[K]>, ReactSelfOf<M[K]>>,
		options?: PatchOptions,
	): () => void;
};

/** The callback a React patch of `Kind` takes, typed with the component's props and `this`. */
type ReactCallbackOf<Kind extends PatchType, P, Self> = Kind extends PatchType.Before
	? ReactBeforeCallback<P, Self>
	: Kind extends PatchType.Instead
		? ReactInsteadCallback<P, Self>
		: ReactAfterCallback<P, Self>;

/** The `patcher.react` namespace: `before`, `instead` and `after` for React components. */
export type ReactPatcher = {
	/** Runs a callback before a component renders; it can return new props for a function component. */
	before: ReactPatch<PatchType.Before>;
	/** Renders a callback's return value in place of a component; `ctx.original()` renders the component. */
	instead: ReactPatch<PatchType.Instead>;
	/** Runs a callback after a component renders; its return value replaces the tree unless it is `undefined`. */
	after: ReactPatch<PatchType.After>;
};

/** Where a component's render lives once its module has loaded. */
export type PatchPlace = {
	parent: PatchParent;
	method: string;
	callback: PatchCallback;
};

/** Patches the place `locate` finds in `parent` once `parent`'s module has loaded. */
export type PatchAt = (
	type: PatchType,
	parent: PatchParent,
	locate: (loaded: PatchParent) => PatchPlace,
	options?: PatchOptions,
) => () => void;

type Render = { parent: PatchParent; method: string; isClass: boolean };

// Method syntax keeps the parameter bivariant, so every typed React callback assigns to it.
type AnyReactCallback = {
	// UNKNOWN: the adapter passes before, instead and after results on to possess unread.
	bivarianceHack(ctx: ReactAfterContext<unknown, unknown>): unknown;
}['bivarianceHack'];

type ComponentArgs = [callback: AnyReactCallback, options?: PatchOptions];

type MemberArgs = [key: string, callback: AnyReactCallback, options?: PatchOptions];

const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

function isClass(component: MetroExport): boolean {
	return typeof component === 'function' && Boolean(component.prototype?.isReactComponent);
}

// Unwraps `memo` to what React calls: the inner function, a `forwardRef`'s `render`, or a class's `prototype.render`.
function renderOf(component: MetroExport): Render | undefined {
	if (isClass(component)) {
		return { parent: component.prototype, method: 'render', isClass: true };
	}

	if (component?.$$typeof === FORWARD_REF) {
		return { parent: component, method: 'render', isClass: false };
	}

	if (component?.$$typeof !== MEMO) {
		return undefined;
	}

	return typeof component.type === 'function' && !isClass(component.type)
		? { parent: component, method: 'type', isClass: false }
		: renderOf(component.type);
}

// A `memo` or `forwardRef` holds its name on the wrapper or on what it wraps.
function nameOf(component: MetroExport): string {
	const inner = component?.type ?? component?.render;

	return (
		component?.displayName ||
		component?.name ||
		inner?.displayName ||
		inner?.name ||
		String(component)
	);
}

function requireRender(component: MetroExport, render: Render | undefined): Render {
	if (!render) {
		throw new TypeError(
			`Failed to patch component ${nameOf(component)}: pass the object holding a function component and its key, as patcher.react.after(parent, key, callback).`,
		);
	}

	return render;
}

function locateMember(parent: PatchParent, key: string): Render {
	const value = parent[key];

	if (typeof value === 'function' && !isClass(value)) {
		return { parent, method: key, isClass: false };
	}

	return requireRender(value, renderOf(value));
}

function boundaryProps(
	patches: readonly PatchFailures[],
	kept: { fallback: ReactNode } | undefined,
): PatchBoundaryProps {
	return kept ? { patches, fallback: kept.fallback } : { patches };
}

// An added element that throws renders nothing. A failing patch falls back to Discord's tree from the same
// render, so its hooks keep their state; three failures in a row remove the patch.
function adapt(
	type: PatchType,
	render: Render,
	callback: AnyReactCallback,
	name: string,
	unpatch: () => void,
): PatchPlace {
	const failures: PatchFailures = { name, count: 0, unstable: false, unpatch };
	const own = [failures];
	const none: PatchFailures[] = [];

	function adapted(ctx: PatchContext) {
		const props = render.isClass ? ctx.this?.props : ctx.args[0];
		const inner = isPatchBoundary(ctx.result) ? ctx.result.props : undefined;
		const result = inner ? inner.children : ctx.result;
		const earlier = inner ? inner.patches : none;
		// Only a patch that has failed pays for the copy, taken before its callback can edit the tree in place.
		let kept = inner ? fallbackOf(inner) : undefined;
		let called: { tree: ReactNode } | undefined;

		// Only an after callback gets Discord's tree as `result`; an instead callback gets it from `original()`.
		if (type === PatchType.After) {
			markDiscordTree(result);
		}

		if (!kept && failures.unstable && type === PatchType.After) {
			kept = { fallback: snapshotTree(result) };
		}

		try {
			const value = callback({
				props,
				this: render.isClass ? ctx.this : undefined,
				result,
				// `ctx.original` is read at call time: the live patcher swaps it in to track hooks.
				original: (next = props) => {
					const tree = render.isClass
						? ctx.original()
						: ctx.original(next, ...ctx.args.slice(1));

					called = { tree };
					markDiscordTree(tree);

					if (!kept && failures.unstable) {
						kept = { fallback: snapshotTree(tree) };
					}

					return tree;
				},
			});

			if (type === PatchType.Before) {
				recordSuccess(failures);

				return !render.isClass && value !== undefined
					? [value, ...ctx.args.slice(1)]
					: undefined;
			}

			if (type === PatchType.Instead && value === undefined) {
				return undefined;
			}

			// The boundary resets the count once this tree commits cleanly.
			return withPatchBoundary(
				isolateAdded(value === undefined ? result : value, name),
				boundaryProps(inner ? [...earlier, failures] : own, kept),
			);
		} catch (error) {
			// The live patcher catches a late hook itself and remounts the component.
			if (error instanceof LateHook) {
				throw error;
			}

			recordFailure(failures, error);

			if (type === PatchType.Before) {
				return undefined;
			}

			// The original runs at most once per render, so its hooks keep their order.
			const fallback = kept
				? kept.fallback
				: type === PatchType.After
					? result
					: (called?.tree ?? ctx.original(...ctx.args));

			return withPatchBoundary(fallback, boundaryProps(earlier, inner && fallbackOf(inner)));
		}
	}

	return { parent: render.parent, method: render.method, callback: adapted };
}

function isComponentArgs(args: ComponentArgs | MemberArgs): args is ComponentArgs {
	return typeof args[0] === 'function';
}

/**
 * @description Builds `patcher.react` on a patcher's placement step, so a scoped patcher's React patches stay in its scope.
 * @param patchAt Places a patch once its module loads, under the patcher's options.
 * @returns The `before`, `instead` and `after` hooks for React components.
 */
export function createReactPatcher(patchAt: PatchAt): ReactPatcher {
	function hook(type: PatchType) {
		return (target: PatchParent, ...args: ComponentArgs | MemberArgs): (() => void) => {
			// Read when a render fails, by which time `patchAt` has returned.
			let remove = noop;
			const unpatch = () => remove();

			if (isComponentArgs(args)) {
				const [callback, options] = args;

				remove = patchAt(
					type,
					target,
					(loaded) =>
						adapt(
							type,
							requireRender(loaded, renderOf(loaded)),
							callback,
							nameOf(loaded),
							unpatch,
						),
					options,
				);

				return remove;
			}

			const [key, callback, options] = args;

			remove = patchAt(
				type,
				target,
				(loaded) => adapt(type, locateMember(loaded, key), callback, key, unpatch),
				options,
			);

			return remove;
		};
	}

	return {
		before: hook(PatchType.Before),
		instead: hook(PatchType.Instead),
		after: hook(PatchType.After),
	};
}
