import { patcher } from '@unbound-app/api';

import { patchThemeColors, restoreThemeColors } from '~/patches';

export function start() {
	patchThemeColors();
}

export function stop() {
	patcher.unpatchAll();
	restoreThemeColors();
}
