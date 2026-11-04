import { patcher } from '@unbound-app/api';

import { ownRemovalFromRequest, type RemovalMethod } from '~/own-removal-routes';
import { REST } from '~/modules';
import type { Session } from '~/session';

const METHODS: readonly RemovalMethod[] = ['del', 'post'];

/**
 * @description Marks removals the user makes from the API requests that make them, so every call path is covered, including ones that skip the action creators' exports.
 * @param session The running session.
 * @returns A function that removes the patches.
 */
export function patchRestRemovals(session: Session): () => void {
	const unpatches = METHODS.filter((method) => typeof REST[method] === 'function').map((method) =>
		patcher.before(REST, method, ({ args: [request] }) => {
			const removal = ownRemovalFromRequest(method, request);

			if (removal) session.manual[removal.kind].mark(removal.id);
		}),
	);

	return () => {
		for (const unpatch of unpatches) unpatch();
	};
}
