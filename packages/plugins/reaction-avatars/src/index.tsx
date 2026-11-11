import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startReactions } from '~/reactions';

export const { start, stop, selfTest } = runFeatures(startReactions, { atomic: true });
