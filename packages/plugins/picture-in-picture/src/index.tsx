import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { startPictureInPicture, stopPictureInPicture } from '~/picture-in-picture';

export function start(context: PluginContext) {
	startPictureInPicture(context);
}

export function stop() {
	stopPictureInPicture();
}

export { featureSelfTest as selfTest };
