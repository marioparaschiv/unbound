import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startPronouns } from '~/pronouns';

export const { start, stop, selfTest } = runFeatures([startPronouns]);
