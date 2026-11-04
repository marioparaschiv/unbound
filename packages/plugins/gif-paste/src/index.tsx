import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startGifPaste } from '~/gif-paste';

export function start() {
	startGifPaste();
}

export { featureSelfTest as selfTest };
