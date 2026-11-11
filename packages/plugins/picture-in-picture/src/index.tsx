import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startPictureInPicture } from '~/picture-in-picture';

export const { start, stop, selfTest } = runFeatures([startPictureInPicture]);
