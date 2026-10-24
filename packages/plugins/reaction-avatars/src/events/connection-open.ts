import { metro } from '@unbound-app/api';

import { reloadReactors } from '~/native/reaction-surfaces';
import type { Session } from '~/native/session';

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

	metro.common.Dispatcher.subscribe('CONNECTION_OPEN', onConnectionOpen);

	return () => metro.common.Dispatcher.unsubscribe('CONNECTION_OPEN', onConnectionOpen);
}
