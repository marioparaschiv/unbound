import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startWebViewAdblock } from '~/webview';

export function start() {
	startWebViewAdblock();
}

export { featureSelfTest as selfTest };
