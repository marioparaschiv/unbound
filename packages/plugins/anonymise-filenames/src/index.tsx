import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { anonymiseFeatures } from '~/anonymise';

export const { start, stop, selfTest } = runFeatures(anonymiseFeatures);
