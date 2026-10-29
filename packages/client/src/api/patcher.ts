/**
 * @description The function patcher, built on `possess`. Exposes `createPatcher` for scoped patchers along
 * with the standalone `before`/`after`/`instead` hooks and unpatch helpers. Patching a React component
 * updates its mounted instances in place, keeping their state, including when a callback calls hooks.
 * Patching a lazy module proxy waits for its module to load instead of loading it.
 * This is the public surface behind `unbound.patcher` and `@unbound-app/api/patcher`.
 */
import type { PatchCallback, PatchOptions, PatchParent, PatcherInstance, PropOf } from 'possess';
import uuid from '@unbound-app/utils/uuid';
import * as Possess from 'possess';

import { currentAddonAttribution, withAddonAttribution } from '~/api/crash-guard';
import { patch, recordRemovals } from '~/lib/hot/live-patch';
import { getLazyModule } from '~/api/metro/lazy-registry';

type ScopedPatcher = Pick<PatcherInstance, 'before' | 'instead' | 'after'>;

type Apply = (parent: PatchParent) => () => void;

type PendingPatch = {
	caller: string | undefined;
	cancel: () => void;
};

const pending = new Set<PendingPatch>();

export * from 'possess';

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
	return whenLoaded(parent, options?.caller, (target) =>
		patch(Possess.PatchType.Before, target, method, callback as PatchCallback, options),
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
	callback: Parameters<typeof Possess.before<M, P>>[2],
	options?: PatchOptions,
): () => void {
	return whenLoaded(parent, options?.caller, (target) =>
		patch(Possess.PatchType.Instead, target, method, callback as PatchCallback, options),
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
	callback: Parameters<typeof Possess.before<M, P>>[2],
	options?: PatchOptions,
): () => void {
	return whenLoaded(parent, options?.caller, (target) =>
		patch(Possess.PatchType.After, target, method, callback as PatchCallback, options),
	);
}

// A lazy module proxy's module may not have loaded, so the patch waits for it rather than loading it.
function whenLoaded(parent: PatchParent, caller: string | undefined, apply: Apply): () => void {
	const lazy = getLazyModule(parent);

	if (!lazy) {
		return apply(parent);
	}

	const attribution = currentAddonAttribution();
	const entry: PendingPatch = { caller, cancel };
	let unpatch: (() => void) | undefined;

	pending.add(entry);

	const stop = lazy.wait((mdl) => {
		pending.delete(entry);
		unpatch = withAddonAttribution(attribution, () => apply(lazy.adopt(mdl)));
	});

	function cancel() {
		pending.delete(entry);
		stop();
	}

	return () => {
		cancel();
		unpatch?.();
		unpatch = undefined;
	};
}

// Removing a patch that a later patch has wrapped keeps that wrapper installed.
function keepLaterWrapper(parent: PatchParent, key: PropertyKey, unpatch: () => void) {
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

function cancelPending(matches: (caller: string | undefined) => boolean) {
	for (const entry of pending) {
		if (matches(entry.caller)) {
			entry.cancel();
		}
	}
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

	function scopedPatch(
		phase: Possess.PatchType,
		parent: PatchParent,
		method: string,
		callback: PatchCallback,
		options: PatchOptions,
	): () => void {
		const merged = { ...defaults, ...options };
		const unpatch = whenLoaded(parent, merged.caller, (target) =>
			keepLaterWrapper(target, method, patch(phase, target, method, callback, merged)),
		);

		function remove(): void {
			if (!unpatches.delete(remove)) return;

			unpatch();
		}

		unpatches.add(remove);

		return remove;
	}

	const scoped: ScopedPatcher = {
		before<M extends PatchParent, P extends PropOf<M>>(
			parent: M,
			method: P,
			callback: Parameters<typeof Possess.before<M, P>>[2],
			options: PatchOptions = {},
		) {
			return scopedPatch(
				Possess.PatchType.Before,
				parent,
				method,
				callback as PatchCallback,
				options,
			);
		},
		instead<M extends PatchParent, P extends PropOf<M>>(
			parent: M,
			method: P,
			callback: Parameters<typeof Possess.before<M, P>>[2],
			options: PatchOptions = {},
		) {
			return scopedPatch(
				Possess.PatchType.Instead,
				parent,
				method,
				callback as PatchCallback,
				options,
			);
		},
		after<M extends PatchParent, P extends PropOf<M>>(
			parent: M,
			method: P,
			callback: Parameters<typeof Possess.before<M, P>>[2],
			options: PatchOptions = {},
		) {
			return scopedPatch(
				Possess.PatchType.After,
				parent,
				method,
				callback as PatchCallback,
				options,
			);
		},
	};

	return {
		...scoped,
		unpatchAll(): void {
			for (const unpatch of unpatches) unpatch();
		},
	};
}

/**
 * @description Removes every patch.
 */
export function unpatchAll(): void {
	cancelPending(() => true);
	recordRemovals(() => true);
	Possess.unpatchAll();
}

/**
 * @description Removes every patch made with a caller id.
 * @param caller The caller id.
 */
export function unpatchAllByCaller(caller: string): void {
	cancelPending((pendingCaller) => pendingCaller === caller);
	recordRemovals((patch) => patch.caller === caller);
	Possess.unpatchAllByCaller(caller);
}
