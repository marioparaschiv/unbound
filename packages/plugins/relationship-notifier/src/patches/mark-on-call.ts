import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { MetroFilter } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import type { ManualRemovals } from '~/removals';

type ActionCreators = Record<string, (...args: unknown[]) => unknown>;

/**
 * @description Marks the id an action creator is called with as a removal the user made, once its module loads.
 * @param filter The action creators' module.
 * @param methods The methods whose first argument is the id of what the user removes.
 * @param removals Where the ids are marked.
 * @returns A function that stops waiting and removes the patches.
 */
export function markOnCall(
	filter: MetroFilter,
	methods: readonly string[],
	removals: ManualRemovals,
): () => void {
	return whenLoaded<ActionCreators>(filter, (module: ActionCreators) => {
		const unpatches = methods
			.filter((method) => typeof module[method] === 'function')
			.map((method) =>
				patcher.before(module, method, ({ args: [id] }) => {
					if (typeof id === 'string') removals.mark(id);
				}),
			);

		return () => {
			for (const unpatch of unpatches) unpatch();
		};
	});
}
