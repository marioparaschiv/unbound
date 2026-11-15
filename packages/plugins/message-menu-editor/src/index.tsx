import { patcher } from '@unbound-app/api';

import { patchMessageMenu } from '~/patches/message-menu';
import SettingsPanel from '~/settings';

export { SettingsPanel };

export function start() {
	patchMessageMenu();
}

export function stop() {
	patcher.unpatchAll();
}
