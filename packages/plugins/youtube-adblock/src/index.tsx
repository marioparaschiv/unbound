import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startWebViewAdblock } from '~/webview';

export const { start, stop, selfTest } = runFeatures([startWebViewAdblock]);
