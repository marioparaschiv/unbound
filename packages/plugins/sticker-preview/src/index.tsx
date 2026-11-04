import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startStickerStaging, stopStickerStaging } from '~/sticker-staging';

export function start() {
	startStickerStaging();
}

export function stop() {
	stopStickerStaging();
}

export { featureSelfTest as selfTest };
