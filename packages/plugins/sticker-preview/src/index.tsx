import { patcher } from '@unbound-app/api';

import { clearStagedStickers, stageStickers } from '~/patches';

export function start() {
	stageStickers();
}

export function stop() {
	patcher.unpatchAll();
	clearStagedStickers();
}
