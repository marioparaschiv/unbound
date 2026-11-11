import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startTags, tagsSelfTest } from '~/tags';

export const { start, stop, selfTest } = runFeatures([startTags], { selfTest: tagsSelfTest });
