import { patcher } from '@unbound-app/api';

import { patchChatRows } from '~/patches';
import SettingsPanel from '~/settings';

export function start() {
	patchChatRows();
}

export function stop() {
	patcher.unpatchAll();
}

export { SettingsPanel };
