import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startReviews } from '~/reviews';

export const { start, stop, selfTest } = runFeatures([startReviews]);
