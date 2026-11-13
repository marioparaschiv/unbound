import { patcher } from '@unbound-app/api';

import {
	patchProfileEffects,
	patchThemeColors,
	restoreProfileEffects,
	restoreThemeColors,
} from '~/patches';

export function start() {
	patchThemeColors();
	patchProfileEffects();
}

export function stop() {
	patcher.unpatchAll();
	restoreThemeColors();
	restoreProfileEffects();
}
