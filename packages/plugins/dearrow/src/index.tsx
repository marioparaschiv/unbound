import { patcher } from '@unbound-app/api';

import { patchMessageActionSheets, patchMessageRows, patchRowManager } from '~/patches';
import { listenToSettings, redrawOriginalEmbeds, startSession } from '~/lib/session';

export function start() {
	startSession();
	patchRowManager();
	patchMessageRows();
	patchMessageActionSheets();
	listenToSettings();
}

// The patches stay until the redrawn rows were bound again: the `RowManager` patch marks them, and the row patch is inert once the session ended.
export async function stop() {
	await redrawOriginalEmbeds();
	patcher.unpatchAll();
}
