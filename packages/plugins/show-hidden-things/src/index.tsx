import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startInvitePermissions } from '~/invites';
import { startTimeoutIcons } from '~/timeouts';

/** Starts each feature on its own, so one that throws is logged and recorded while the other still starts. */
export function start() {
	startFeatures('Show Hidden Things', [startTimeoutIcons, startInvitePermissions]);
}

export { featureSelfTest as selfTest };
