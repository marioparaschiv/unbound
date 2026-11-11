import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startViewRaw } from '~/raw';

export const { start, stop, selfTest } = runFeatures(startViewRaw);
