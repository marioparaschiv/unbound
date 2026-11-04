import { flux } from '@unbound-app/api';

import { syncAndRunChecks } from '~/checks';
import type { Session } from '~/session';

/**
 * @description Reports removals that happened while the gateway was disconnected, each time it connects.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */
export function subscribeConnectionOpen(session: Session): () => void {
	return flux.onAction('CONNECTION_OPEN', () => void syncAndRunChecks(session));
}
