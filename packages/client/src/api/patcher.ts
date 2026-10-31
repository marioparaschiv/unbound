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
import uuid from '@unbound-app/utils/uuid';
import * as Possess from 'possess';

import { patch, recordRemovals } from '~/lib/hot/live-patch';

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

type ScopedPatcher = Pick<PatcherInstance, 'before' | 'instead' | 'after'>;

export type { PatchOptions, PatchParent, PropOf } from 'possess';
export { PATCH_SYMBOL, PatchType, patches } from 'possess';

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
	return patch(Possess.PatchType.Before, parent, method, callback, options);
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
	return patch(Possess.PatchType.Instead, parent, method, callback, options);
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
	return patch(Possess.PatchType.After, parent, method, callback, options);
}

function trackPatches<T extends (...args: never[]) => () => void>(
	method: T,
	unpatches: Set<() => void>,
): T {
	function register(...args: never[]): () => void {
		const unpatch = Reflect.apply(method, undefined, args);
		const parent = args[0] as object;
		const key = args[1] as PropertyKey;
		const installed = Reflect.get(parent, key);
		let active = true;

		function remove(): void {
			if (!active) return;

			active = false;
			unpatches.delete(remove);

			if (Reflect.get(parent, key) !== installed) {
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

				return;
			}

			unpatch();
		}
		unpatches.add(remove);

		return remove;
	}

	return register as T;
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
	const scoped: ScopedPatcher = {
		before(parent, method, callback, options = {}) {
			return before(parent, method, callback, { ...defaults, ...options });
		},
		instead(parent, method, callback, options = {}) {
			return instead(parent, method, callback, { ...defaults, ...options });
		},
		after(parent, method, callback, options = {}) {
			return after(parent, method, callback, { ...defaults, ...options });
		},
	};

	return {
		before: trackPatches(scoped.before, unpatches),
		instead: trackPatches(scoped.instead, unpatches),
		after: trackPatches(scoped.after, unpatches),
		unpatchAll(): void {
			for (const unpatch of unpatches) unpatch();
		},
	};
}

/**
 * @description Removes every patch.
 */
export function unpatchAll(): void {
	recordRemovals(() => true);
	Possess.unpatchAll();
}

/**
 * @description Removes every patch made with a caller id.
 * @param caller The caller id.
 */
export function unpatchAllByCaller(caller: string): void {
	recordRemovals((patch) => patch.caller === caller);
	Possess.unpatchAllByCaller(caller);
}
