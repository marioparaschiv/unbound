import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startTypingAvatars } from '~/typing-avatars';

export const { start, stop, selfTest } = runFeatures([startTypingAvatars]);
