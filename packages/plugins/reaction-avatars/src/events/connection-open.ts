import { flux } from '@unbound-app/api';

import { reloadReactors } from '~/ios/reaction-surfaces';
import type { Session } from '~/ios/session';

/**
 * @description Refetches every shown reactor list after the gateway reconnects, since reactions changed while it was away.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */
export function subscribeConnectionOpen(session: Session): () => void {
	function onConnectionOpen() {
		session.reactors.clear();
		reloadReactors(session, () => true);
	}

	return flux.onAction('CONNECTION_OPEN', onConnectionOpen);
}
