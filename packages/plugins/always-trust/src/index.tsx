import { patcher } from '@unbound-app/api';

import { patchSuspiciousDownloads, patchTrustedDomains } from '~/patches';

export function start() {
	patchTrustedDomains();
	patchSuspiciousDownloads();
}

export function stop() {
	patcher.unpatchAll();
}
