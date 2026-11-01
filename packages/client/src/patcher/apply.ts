import toError from '@unbound-app/utils/to-error';
import noop from '@unbound-app/utils/noop';
import type { PatchParent } from 'possess';

import { currentAddonScope, withAddonScope } from '~/addons/crash-guard';
import { whenModuleLoads } from '~/metro/lazy-registry';

/** Every patch still waiting for its module, with the caller id it was made under. */
export const pendingPatchCallers = new Map<() => void, string | undefined>();

/**
 * @description Applies a patch once its target module loads, at once when it already has. A deferred patch
 * runs inside the Addon scope that asked for it, so a failure is charged to that addon.
 * @param parent The object holding the method, or a lazy module proxy.
 * @param caller The caller id the pending patch is filed under, for `unpatchAllByCaller`.
 * @param apply Patches the loaded target and returns its remover.
 * @returns A function removing the patch, or dropping it if it has not been applied yet.
 */
export function patchWhenLoaded(
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
			if (!scope?.recordDeferredFailure) {
				throw error;
			}

			scope.recordDeferredFailure(toError(error));
		}
	});
	deferred = true;

	return () => {
		drop();
		unpatch();
		unpatch = noop;
	};
}

/**
 * @description Wraps a remover so it leaves alone a replacement someone assigned to the key after the patch.
 * @param parent The patched object.
 * @param key The patched key.
 * @param unpatch The patch's remover.
 * @returns The wrapped remover.
 */
export function unpatchKeepingReplacement(
	parent: PatchParent,
	key: PropertyKey,
	unpatch: () => void,
) {
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
