import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { avatarsSelfTest, startAvatars } from '~/avatars';

export const { start, stop, selfTest } = runFeatures([startAvatars], { selfTest: avatarsSelfTest });
