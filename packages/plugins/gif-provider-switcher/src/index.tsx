import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startRequests } from '~/requests';
import { startPicker } from '~/picker';

// One feature throwing must not cost the other.
export const { start, stop, selfTest } = runFeatures([startPicker, startRequests]);
