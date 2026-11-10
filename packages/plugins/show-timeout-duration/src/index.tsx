import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startTimeoutRemaining } from '~/timeout-remaining';

export const { start, stop, selfTest } = runFeatures([startTimeoutRemaining]);
