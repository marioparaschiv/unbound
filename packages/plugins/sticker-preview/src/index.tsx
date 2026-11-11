import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startStickerStaging } from '~/sticker-staging';

export const { start, stop, selfTest } = runFeatures(startStickerStaging, { atomic: true });
