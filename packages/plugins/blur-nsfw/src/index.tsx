import { patcher } from '@unbound-app/api';

import { restoreBlurredRows } from '~/lib/blur';
import { patchRowManager } from '~/patches';

export function start() {
	patchRowManager();
}

export function stop() {
	patcher.unpatchAll();
	restoreBlurredRows();
}
