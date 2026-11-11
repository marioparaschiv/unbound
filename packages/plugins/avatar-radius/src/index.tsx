import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { selfTestAvatars, startAvatars } from '~/avatars';

export const { start, stop, selfTest } = runFeatures([startAvatars], { selfTest: selfTestAvatars });
