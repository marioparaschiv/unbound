import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startMultiAccount } from '~/multi-account';

export const { start, stop, selfTest } = runFeatures([startMultiAccount]);
