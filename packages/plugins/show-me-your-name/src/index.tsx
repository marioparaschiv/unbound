import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startNames } from '~/names';

export const { start, stop, selfTest } = runFeatures([startNames]);
