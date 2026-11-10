import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startSilent } from '~/silent';

export const { start, stop, selfTest } = runFeatures(startSilent);
