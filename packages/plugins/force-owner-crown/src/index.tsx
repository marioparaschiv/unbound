import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startCrown } from '~/crown';

export const { start, stop, selfTest } = runFeatures([startCrown]);
