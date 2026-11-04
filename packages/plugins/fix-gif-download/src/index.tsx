import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startShareActions } from '~/share';
import { startDownloads } from '~/download';

export function start() {
	startShareActions();
	startDownloads();
}

export { featureSelfTest as selfTest };
