import type { PatchCallback, PatchOptions, PatchParent } from 'possess';
import noop from '@unbound-app/utils/noop';
import uuid from '@unbound-app/utils/uuid';
import * as Possess from 'possess';

import { patchWhenLoaded, unpatchKeepingReplacement } from '~/patcher/apply';
import type { ReactPatcher, PatchPlace } from '~/patcher/react';
import { createRepeatTracker } from '~/patcher/patch-repeats';
import { guardedCallback } from '~/patcher/guarded-callback';
import type { after, before, instead } from '~/patcher/api';
import { createReactPatcher } from '~/patcher/react';
import { patch } from '~/hot-refresh/live-patch';
import { assignValue } from '~/patcher/assign';

/** The patcher `createPatcher` returns. */
export type PatcherInstance = {
	before: typeof before;
	instead: typeof instead;
	after: typeof after;
	react: ReactPatcher;
	assign: typeof assignValue;
	unpatchAll: () => void;
};

const repeats = createRepeatTracker();

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
			const uncount = repeats.add(place.parent, `${merged.caller} ${place.method}`);
			const remove = unpatchKeepingReplacement(
				place.parent,
				place.method,
				patch(type, place.parent, place.method, place.callback, merged),
			);

			return () => {
				uncount();
				remove();
			};
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
			const caller = options?.caller ?? defaults.caller;
			let remove = noop;
			const guarded = guardedCallback(callback, `${caller} ${method}`, () => remove());

			remove = patchAt(
				type,
				parent,
				(target) => ({ parent: target, method, callback: guarded }),
				options,
			);

			return remove;
		};
	}

	return {
		before: scoped(Possess.PatchType.Before) as typeof before,
		instead: scoped(Possess.PatchType.Instead) as typeof instead,
		after: scoped(Possess.PatchType.After) as typeof after,
		react: createReactPatcher(patchAt),
		assign(parent, key, value) {
			const restore = assignValue(parent, key, value);

			function remove() {
				unpatches.delete(remove);
				restore();
			}

			unpatches.add(remove);

			return remove;
		},
		unpatchAll(): void {
			for (const unpatch of unpatches) unpatch();
		},
	};
}
