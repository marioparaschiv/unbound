import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startCounter } from '~/counter';

export const { start, stop, selfTest } = runFeatures([startCounter]);
