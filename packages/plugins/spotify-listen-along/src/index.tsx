import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startListenAlongInvite } from '~/invite';
import { startListenAlong } from '~/listen';

export function start() {
	startListenAlong();
	startListenAlongInvite();
}

export { featureSelfTest as selfTest };
