import { START_CHECK_DELAY } from '~/constants';
import { syncAndRunChecks } from '~/checks';
import { isConnected } from '~/discord';
import type { Session } from '~/session';

/**
 * @description Runs the first check a few seconds after the plugin starts while Discord is already connected, as Vencord does.
 * @param session The running session.
 * @returns A function that cancels the check if it has not run.
 */
export function scheduleStartCheck(session: Session): () => void {
	const timer = setTimeout(() => {
		if (isConnected()) void syncAndRunChecks(session);
	}, START_CHECK_DELAY);

	return () => clearTimeout(timer);
}
