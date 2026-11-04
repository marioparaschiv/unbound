import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchWebView } from '~/patches/webview';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	dispose = applyFeatures(PLUGIN_NAME, [patchWebView]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default { start, stop, selfTest: featureSelfTest };
