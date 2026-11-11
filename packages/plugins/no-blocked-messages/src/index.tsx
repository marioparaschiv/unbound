import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startBlocked } from '~/blocked';

export const { start, stop, selfTest } = runFeatures([startBlocked]);
