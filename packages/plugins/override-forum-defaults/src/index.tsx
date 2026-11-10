import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startForumDefaults } from '~/forum-defaults';

export const { start, stop, selfTest } = runFeatures([startForumDefaults]);
