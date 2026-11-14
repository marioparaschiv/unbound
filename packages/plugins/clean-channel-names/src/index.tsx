import { patcher } from '@unbound-app/api';

import { patchChannelNames, restoreChannelNames } from '~/patches';
import SettingsPanel from '~/settings';

export function start() {
	patchChannelNames();
}

export function stop() {
	patcher.unpatchAll();
	restoreChannelNames();
}

export { SettingsPanel };
