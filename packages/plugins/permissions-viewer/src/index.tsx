import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { viewerFeatures } from '~/viewer';

export const { start, stop, selfTest } = runFeatures(viewerFeatures);
