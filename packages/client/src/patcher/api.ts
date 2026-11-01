/**
 * @description The function patcher, built on `possess`: the `before`/`after`/`instead` hooks and unpatch
 * helpers. Patching a React component updates its mounted instances in place, keeping their state,
 * including when a callback calls hooks.
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
import * as Possess from 'possess';

import { patchWhenLoaded, pendingPatchCallers } from '~/patcher/apply';
import { patch, recordRemovals } from '~/hot-refresh/live-patch';

/** Whether `T` is `any`, so a patch on an untyped method keeps loose types. */
type IsUntyped<T> = 0 extends 1 & T ? true : false;

/** The arguments a patch receives for method `F`: its parameters, or its constructor's for a class. */
type ArgsOf<F> =
	IsUntyped<F> extends true
		? F[]
		: F extends AnyFunction
			? Parameters<F>
			: F extends AnyConstructor
				? ConstructorParameters<F>
				: never;

/** The result a patch receives for method `F`: its return value, or an instance for a class. */
type ResultOf<F> =
	IsUntyped<F> extends true
		? F
		: F extends AnyFunction
			? ReturnType<F>
			: F extends AnyConstructor
				? InstanceType<F>
				: never;

/** The `this` a patch receives: the method's declared `this`, else the object `M` holding it. */
type SelfOf<M, F> = unknown extends ThisParameterType<F> ? M : ThisParameterType<F>;

export type { PatchOptions, PatchParent, PropOf } from 'possess';

/**
 * The context a `before` callback receives.
 * @template Args The method's arguments.
 * @template Res The method's result.
 * @template Self The method's `this`.
 */
export type BeforeContext<Args extends unknown[], Res, Self> = {
	/** The arguments of this call; a `before` callback can return a new array to replace them. */
	args: Args;
	/** The `this` the method was called with. */
	this: Self;
	/** The unpatched method; call it with `ctx.this` and `ctx.args` to run the original behavior. */
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

/** Every module the patcher has patched, with its live patches. */
export const patches = Possess.patches;

/** The symbol a patched method carries, pointing at its patch state. */
export const PATCH_SYMBOL = Possess.PATCH_SYMBOL;

/** The kinds of patch: before, instead and after. */
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
