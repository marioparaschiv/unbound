import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { giftFeatures } from '~/gift';

export const { start, stop, selfTest } = runFeatures(giftFeatures);
