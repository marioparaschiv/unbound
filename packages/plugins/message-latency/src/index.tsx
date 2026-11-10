import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { latencyFeatures } from '~/latency-indicator';

export const { start, stop, selfTest } = runFeatures(latencyFeatures, { atomic: true });
