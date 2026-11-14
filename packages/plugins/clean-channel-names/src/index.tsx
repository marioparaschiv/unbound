import { patcher } from '@unbound-app/api';

import { patchChannelNames, restoreChannelNames } from '~/patches';
import SettingsPanel from '~/settings';

let stopFollowing: (() => void) | undefined;

export function start() {
	stopFollowing = patchChannelNames();
}

export function stop() {
	stopFollowing?.();
	stopFollowing = undefined;
	patcher.unpatchAll();
	restoreChannelNames();
}

export { SettingsPanel };
