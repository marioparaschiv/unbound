import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startUnsuppress } from '~/unsuppress';

export const { start, stop, selfTest } = runFeatures([startUnsuppress]);
