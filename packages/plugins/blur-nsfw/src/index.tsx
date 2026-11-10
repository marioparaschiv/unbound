import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startBlurNsfw } from '~/blur-nsfw';

export const { start, stop, selfTest } = runFeatures([startBlurNsfw]);
