import { patcher } from '@unbound-app/api';

import { patchGuildBar, patchGuildMenu, patchGuildSheet, restoreGuildBar } from '~/patches';
import SettingsPanel from '~/settings';

export function start() {
	patchGuildBar();
	patchGuildSheet();
	patchGuildMenu();
}

export function stop() {
	patcher.unpatchAll();
	restoreGuildBar();
}

export { SettingsPanel };
