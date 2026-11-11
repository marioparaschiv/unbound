import { patcher } from '@unbound-app/api';

import { patchPendingReplyActions } from '~/patches';
import SettingsPanel from '~/settings';

export function start() {
	patchPendingReplyActions();
}

export function stop() {
	patcher.unpatchAll();
}

export { SettingsPanel };
