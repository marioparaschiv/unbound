import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { embedFeatures, selfTestEmbeds } from '~/embeds';

export const { start, stop, selfTest } = runFeatures(embedFeatures, {
	atomic: true,
	selfTest: selfTestEmbeds,
});
