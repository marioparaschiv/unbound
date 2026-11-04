import type { PatchCallback, PatchOptions, PatchParent } from 'possess';
import uuid from '@unbound-app/utils/uuid';
import * as Possess from 'possess';

import { patchWhenLoaded, unpatchKeepingReplacement } from '~/patcher/apply';
import type { ReactPatcher, PatchPlace } from '~/patcher/react';
import type { after, before, instead } from '~/patcher/api';
import { createReactPatcher } from '~/patcher/react';
import { patch } from '~/hot-refresh/live-patch';

/** The patcher `createPatcher` returns. */
export type PatcherInstance = {
	before: typeof before;
	instead: typeof instead;
	after: typeof after;
	react: ReactPatcher;
	unpatchAll: () => void;
};

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

	function patchAt(
		type: Possess.PatchType,
		parent: PatchParent,
		locate: (loaded: PatchParent) => PatchPlace,
		options: PatchOptions = {},
	): () => void {
		const merged = { ...defaults, ...options };
		const unpatch = patchWhenLoaded(parent, merged.caller, (target) => {
			const place = locate(target);

			return unpatchKeepingReplacement(
				place.parent,
				place.method,
				patch(type, place.parent, place.method, place.callback, merged),
			);
		});

		function remove() {
			unpatches.delete(remove);
			unpatch();
		}

		unpatches.add(remove);

		return remove;
	}

	function scoped(type: Possess.PatchType) {
		return function scopedPatch(
			parent: PatchParent,
			method: string,
			callback: PatchCallback,
			options?: PatchOptions,
		): () => void {
			return patchAt(
				type,
				parent,
				(target) => ({ parent: target, method, callback }),
				options,
			);
		};
	}

	return {
		before: scoped(Possess.PatchType.Before) as typeof before,
		instead: scoped(Possess.PatchType.Instead) as typeof instead,
		after: scoped(Possess.PatchType.After) as typeof after,
		react: createReactPatcher(patchAt),
		unpatchAll(): void {
			for (const unpatch of unpatches) unpatch();
		},
	};
}
