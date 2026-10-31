/**
 * @description The function patcher, built on `possess`. Exposes `createPatcher` for scoped patchers along
 * with the standalone `before`/`after`/`instead` hooks and unpatch helpers. Patching a React component
 * updates its mounted instances in place, keeping their state, including when a callback calls hooks.
 * This is the public surface behind `unbound.patcher` and `@unbound-app/api/patcher`.
 */
import type {
	AnyConstructor,
	PatchCallback,
	PatchOptions,
	AnyFunction,
	PatchParent,
	PropOf,
} from 'possess';
import toError from '@unbound-app/utils/to-error';
import noop from '@unbound-app/utils/noop';
import uuid from '@unbound-app/utils/uuid';
import * as Possess from 'possess';

import { currentAddonScope, withAddonScope } from '~/addons/crash-guard';
import { patch, recordRemovals } from '~/hot-refresh/live-patch';
import { whenModuleLoads } from '~/metro/lazy-registry';

type IsUntyped<T> = 0 extends 1 & T ? true : false;

type ArgsOf<F> =
	IsUntyped<F> extends true
		? F[]
		: F extends AnyFunction
			? Parameters<F>
			: F extends AnyConstructor
				? ConstructorParameters<F>
				: never;

type ResultOf<F> =
	IsUntyped<F> extends true
		? F
		: F extends AnyFunction
			? ReturnType<F>
			: F extends AnyConstructor
				? InstanceType<F>
				: never;

type SelfOf<M, F> = unknown extends ThisParameterType<F> ? M : ThisParameterType<F>;

export type { PatchOptions, PatchParent, PropOf } from 'possess';

/**
 * The context a `before` callback receives.
 * @template Args The method's arguments.
 * @template Res The method's result.
 * @template Self The method's `this`.
 */
export type BeforeContext<Args extends unknown[], Res, Self> = {
	args: Args;
	this: Self;
	original: (...args: Args) => Res;
};

/**
 * The context an `instead` callback receives.
 * @template Args The method's arguments.
 * @template Res The method's result.
 * @template Self The method's `this`.
 */
export type InsteadContext<Args extends unknown[], Res, Self> = BeforeContext<Args, Res, Self>;

/**
 * The context an `after` callback receives, with the result so far.
 * @template Args The method's arguments.
 * @template Res The method's result.
 * @template Self The method's `this`.
 */
export type AfterContext<Args extends unknown[], Res, Self> = BeforeContext<Args, Res, Self> & {
	result: Res;
};

/**
 * A `before` callback, which can replace the arguments by returning an array.
 * @template Args The method's arguments.
 * @template Res The method's result.
 * @template Self The method's `this`.
 */
export type BeforeCallback<Args extends unknown[], Res, Self> = (
	ctx: BeforeContext<Args, Res, Self>,
) => [...Args] | void;

/**
 * An `instead` callback, whose return value becomes the result unless it is `undefined`.
 * @template Args The method's arguments.
 * @template Res The method's result.
 * @template Self The method's `this`.
 */
export type InsteadCallback<Args extends unknown[], Res, Self> = (
	ctx: InsteadContext<Args, Res, Self>,
) => Res | void;

/**
 * An `after` callback, whose return value replaces the result unless it is `undefined`.
 * @template Args The method's arguments.
 * @template Res The method's result.
 * @template Self The method's `this`.
 */
export type AfterCallback<Args extends unknown[], Res, Self> = (
	ctx: AfterContext<Args, Res, Self>,
) => Res | void;

/**
 * The patcher `createPatcher` returns.
 */
export type PatcherInstance = {
	before: typeof before;
	instead: typeof instead;
	after: typeof after;
	unpatchAll: () => void;
};

const pendingPatchCallers = new Map<() => void, string | undefined>();

/** @internal */
export const patches = Possess.patches;

/** @internal */
export const PATCH_SYMBOL = Possess.PATCH_SYMBOL;

/** @internal */
export const PatchType = Possess.PatchType;

/**
 * @description Runs a callback before a method, which can replace its arguments by returning an array.
 * @template M The object holding the method.
 * @template P The method's key.
 * @param parent The object holding the method.
 * @param method The method's key.
 * @param callback Receives the patch context.
 * @param options Patch options.
 * @returns A function removing the patch.
 */
export function before<M extends PatchParent, P extends PropOf<M>>(
	parent: M,
	method: P,
	callback: BeforeCallback<ArgsOf<M[P]>, ResultOf<M[P]>, SelfOf<M, M[P]>>,
	options?: PatchOptions,
): () => void;
export function before(
	parent: PatchParent,
	method: string,
	callback: PatchCallback,
	options?: PatchOptions,
): () => void {
	return patchWhenLoaded(parent, options?.caller, (target) =>
		patch(Possess.PatchType.Before, target, method, callback, options),
	);
}

/**
 * @description Runs a callback in place of a method, which can call `ctx.original` and replaces its result.
 * @template M The object holding the method.
 * @template P The method's key.
 * @param parent The object holding the method.
 * @param method The method's key.
 * @param callback Receives the patch context.
 * @param options Patch options.
 * @returns A function removing the patch.
 */
export function instead<M extends PatchParent, P extends PropOf<M>>(
	parent: M,
	method: P,
	callback: InsteadCallback<ArgsOf<M[P]>, ResultOf<M[P]>, SelfOf<M, M[P]>>,
	options?: PatchOptions,
): () => void;
export function instead(
	parent: PatchParent,
	method: string,
	callback: PatchCallback,
	options?: PatchOptions,
): () => void {
	return patchWhenLoaded(parent, options?.caller, (target) =>
		patch(Possess.PatchType.Instead, target, method, callback, options),
	);
}

/**
 * @description Runs a callback after a method, which can replace its result by returning a value.
 * @template M The object holding the method.
 * @template P The method's key.
 * @param parent The object holding the method.
 * @param method The method's key.
 * @param callback Receives the patch context.
 * @param options Patch options.
 * @returns A function removing the patch.
 */
export function after<M extends PatchParent, P extends PropOf<M>>(
	parent: M,
	method: P,
	callback: AfterCallback<ArgsOf<M[P]>, ResultOf<M[P]>, SelfOf<M, M[P]>>,
	options?: PatchOptions,
): () => void;
export function after(
	parent: PatchParent,
	method: string,
	callback: PatchCallback,
	options?: PatchOptions,
): () => void {
	return patchWhenLoaded(parent, options?.caller, (target) =>
		patch(Possess.PatchType.After, target, method, callback, options),
	);
}

function patchWhenLoaded(
	parent: PatchParent,
	caller: string | undefined,
	apply: (target: PatchParent) => () => void,
): () => void {
	const scope = currentAddonScope();
	let deferred = false;
	let unpatch = noop;
	let stopWaiting = noop;

	function drop() {
		pendingPatchCallers.delete(drop);
		stopWaiting();
	}

	pendingPatchCallers.set(drop, caller);
	stopWaiting = whenModuleLoads(parent, (target) => {
		pendingPatchCallers.delete(drop);

		if (!deferred) {
			unpatch = apply(target);

			return;
		}

		try {
			unpatch = withAddonScope(scope, () => apply(target));
		} catch (error) {
			if (!scope?.fail) {
				throw error;
			}

			scope.fail(toError(error));
		}
	});
	deferred = true;

	return () => {
		drop();
		unpatch();
		unpatch = noop;
	};
}

function unpatchKeepingReplacement(parent: PatchParent, key: PropertyKey, unpatch: () => void) {
	const installed = Reflect.get(parent, key);

	return () => {
		if (Reflect.get(parent, key) === installed) {
			unpatch();

			return;
		}

		const replacement = Reflect.get(parent, key);
		const descriptor = Object.getOwnPropertyDescriptor(parent, key);

		try {
			unpatch();
		} finally {
			if (descriptor) {
				Object.defineProperty(parent, key, descriptor);
			} else {
				Reflect.set(parent, key, replacement);
			}
		}
	};
}

/**
 * @description Creates a patcher whose patches share default options, so they can be removed together.
 * @param defaultOptions A caller id, or options merged into every patch; a caller id is generated if missing.
 * @returns The scoped patcher.
 */
export function createPatcher(defaultOptions: string | PatchOptions): PatcherInstance {
	const defaults =
		typeof defaultOptions === 'string' ? { caller: defaultOptions } : defaultOptions;

	defaults.caller ??= uuid();
	const unpatches = new Set<() => void>();

	function scoped(type: Possess.PatchType) {
		return function scopedPatch(
			parent: PatchParent,
			method: string,
			callback: PatchCallback,
			options: PatchOptions = {},
		): () => void {
			const merged = { ...defaults, ...options };
			const unpatch = patchWhenLoaded(parent, merged.caller, (target) =>
				unpatchKeepingReplacement(
					target,
					method,
					patch(type, target, method, callback, merged),
				),
			);

			function remove() {
				unpatches.delete(remove);
				unpatch();
			}

			unpatches.add(remove);

			return remove;
		};
	}

	return {
		before: scoped(Possess.PatchType.Before) as typeof before,
		instead: scoped(Possess.PatchType.Instead) as typeof instead,
		after: scoped(Possess.PatchType.After) as typeof after,
		unpatchAll(): void {
			for (const unpatch of unpatches) unpatch();
		},
	};
}

/**
 * @description Removes every patch.
 */
export function unpatchAll(): void {
	for (const drop of pendingPatchCallers.keys()) drop();

	recordRemovals(() => true);
	Possess.unpatchAll();
}

/**
 * @description Removes every patch made with a caller id.
 * @param caller The caller id.
 * @internal
 */
export function unpatchAllByCaller(caller: string): void {
	for (const [drop, owner] of pendingPatchCallers) {
		if (owner === caller) {
			drop();
		}
	}

	recordRemovals((patch) => patch.caller === caller);
	Possess.unpatchAllByCaller(caller);
}
