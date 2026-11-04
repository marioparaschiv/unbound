import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startInvitePermissions } from '~/invites';
import { startTimeoutIcons } from '~/timeouts';

export function start() {
	startTimeoutIcons();
	startInvitePermissions();
}

export { featureSelfTest as selfTest };
