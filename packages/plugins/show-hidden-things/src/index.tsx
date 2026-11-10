import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startInvitePermissions } from '~/invites';
import { startTimeoutIcons } from '~/timeouts';

export const { start, stop, selfTest } = runFeatures([startTimeoutIcons, startInvitePermissions]);
