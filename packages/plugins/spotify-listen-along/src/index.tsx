import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startListenAlongInvite } from '~/invite';
import { startListenAlong } from '~/listen';

export const { start, stop, selfTest } = runFeatures([startListenAlong, startListenAlongInvite]);
