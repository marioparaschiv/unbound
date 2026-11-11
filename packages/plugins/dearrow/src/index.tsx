import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { embedFeatures } from '~/embeds';

export const { start, stop, selfTest } = runFeatures(embedFeatures);
