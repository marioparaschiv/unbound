import { settings } from '@unbound-app/settings';

import { readPreferences } from '~/presence/preferences';

/** The preferences a user gets before changing any setting. */
export const SETTINGS = readPreferences(settings);
