import { flux } from '@unbound-app/api';

import { reloadReactors } from '~/reactions/ios/reaction-surfaces';
import type { Session } from '~/reactions/ios/session';

/**
 * @description Refetches every shown reactor list after the gateway reconnects, since reactions changed while it was away.
 * The Addon scope removes the listener when the plugin stops.
 * @param session The running session.
 */
export function subscribeConnectionOpen(session: Session): void {
	function onConnectionOpen() {
		session.reactors.clear();
		reloadReactors(session, () => true);
	}

	flux.onAction('CONNECTION_OPEN', onConnectionOpen);
}
