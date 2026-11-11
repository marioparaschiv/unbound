import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startStillDots } from '~/still-dots';

export const { start, stop, selfTest } = runFeatures([startStillDots]);
