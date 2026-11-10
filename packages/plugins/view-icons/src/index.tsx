import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startImages } from '~/images';

export const { start, stop, selfTest } = runFeatures(startImages);
