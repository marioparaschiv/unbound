import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startMoyai } from '~/moyai';

export const { start, stop, selfTest } = runFeatures([startMoyai]);
