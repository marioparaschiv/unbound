import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMediaKeyboardItem } from '~/patches/media-keyboard-item';
import { createFileSizes } from '~/file-sizes/platform';

let releaseFileSizes = () => {};

export function start(context: PluginContext) {
	const sizes = createFileSizes(context);

	releaseFileSizes = sizes.release;
	patchMediaKeyboardItem(sizes.lookup);
	recordApplied(1);
}

export function stop() {
	releaseFileSizes();
}

export { featureSelfTest as selfTest };
