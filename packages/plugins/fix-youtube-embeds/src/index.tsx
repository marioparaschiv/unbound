import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { selfTestYoutubeEmbeds, youtubeEmbedFeatures } from '~/youtube-embeds';

export const { start, stop, selfTest } = runFeatures(youtubeEmbedFeatures, {
	selfTest: selfTestYoutubeEmbeds,
});
