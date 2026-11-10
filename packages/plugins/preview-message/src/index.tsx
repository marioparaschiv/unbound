import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startPreview } from '~/preview';

export const { start, stop, selfTest } = runFeatures([startPreview]);
