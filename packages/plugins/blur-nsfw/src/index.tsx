import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startBlurNsfw, stopBlurNsfw } from '~/blur-nsfw';

export function start() {
	startBlurNsfw();
}

export function stop() {
	stopBlurNsfw();
}

export { featureSelfTest as selfTest };
