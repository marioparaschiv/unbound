import { moveSyncSession } from '~/account/legacy-session';
import { refresh } from '~/account/api';

/** Takes over Sync's session, then refreshes the account in the background. */
export function start() {
	moveSyncSession();
	void refresh();
}

export default { start };
