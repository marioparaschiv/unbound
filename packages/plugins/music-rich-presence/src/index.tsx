import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startPresence } from '~/presence';

// Stopping clears the activity the plugin sent, which the Addon scope cannot see.
export const { start, stop, selfTest } = runFeatures([startPresence]);
