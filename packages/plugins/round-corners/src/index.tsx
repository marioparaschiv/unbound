import { patcher } from '@unbound-app/api';

import { patchTargets, stopWaiting } from '~/patches/targets';
import { patchSelectionFrame } from '~/patches/selection-frame';

let stopFrame: (() => void) | undefined;

export function start() {
	stopFrame = patchSelectionFrame();
	patchTargets();
}

export function stop() {
	stopFrame?.();
	stopWaiting();
	patcher.unpatchAll();
}
