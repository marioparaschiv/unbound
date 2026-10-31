/**
 * @description The function patcher, built on `possess`. Exposes `createPatcher` for scoped patchers along
 * with the standalone `before`/`after`/`instead` hooks and unpatch helpers. Patching a React component
 * updates its mounted instances in place, keeping their state, including when a callback calls hooks.
 * This is the public surface behind `unbound.patcher` and `@unbound-app/api/patcher`.
 */
import type { PatchCallback, PatchOptions, PatchParent, PatcherInstance, PropOf } from 'possess';
import uuid from '@unbound-app/utils/uuid';
import * as Possess from 'possess';

import { patch, recordRemovals } from '~/lib/hot/live-patch';

type ScopedPatcher = Pick<PatcherInstance, 'before' | 'instead' | 'after'>;

export * from 'possess';

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
	callback: Parameters<typeof Possess.before<M, P>>[2],
	options?: PatchOptions,
): () => void {
	return patch(Possess.PatchType.Before, parent, method, callback as PatchCallback, options);
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
	callback: Parameters<typeof Possess.before<M, P>>[2],
	options?: PatchOptions,
): () => void {
	return patch(Possess.PatchType.Instead, parent, method, callback as PatchCallback, options);
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
	callback: Parameters<typeof Possess.before<M, P>>[2],
	options?: PatchOptions,
): () => void {
	return patch(Possess.PatchType.After, parent, method, callback as PatchCallback, options);
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
		before<M extends PatchParent, P extends PropOf<M>>(
			parent: M,
			method: P,
			callback: Parameters<typeof Possess.before<M, P>>[2],
			options: PatchOptions = {},
		) {
			return before(parent, method, callback, { ...defaults, ...options });
		},
		instead<M extends PatchParent, P extends PropOf<M>>(
			parent: M,
			method: P,
			callback: Parameters<typeof Possess.before<M, P>>[2],
			options: PatchOptions = {},
		) {
			return instead(parent, method, callback, { ...defaults, ...options });
		},
		after<M extends PatchParent, P extends PropOf<M>>(
			parent: M,
			method: P,
			callback: Parameters<typeof Possess.before<M, P>>[2],
			options: PatchOptions = {},
		) {
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
 * @internal
 */
export function unpatchAllByCaller(caller: string): void {
	recordRemovals((patch) => patch.caller === caller);
	Possess.unpatchAllByCaller(caller);
}
