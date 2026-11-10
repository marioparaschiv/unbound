import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startFileSizes } from '~/file-sizes';

export const { start, stop, selfTest } = runFeatures([startFileSizes]);
