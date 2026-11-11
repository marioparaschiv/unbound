import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { animateFeatures } from '~/animate';

export const { start, stop, selfTest } = runFeatures(animateFeatures());
