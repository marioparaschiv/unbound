import { patcher } from '@unbound-app/api';

import { patchCommands } from '~/patches';
import SettingsPanel from '~/settings';

export function start() {
	patchCommands();
}

export function stop() {
	patcher.unpatchAll();
}

export { SettingsPanel };
