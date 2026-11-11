import { settings } from '@unbound-app/settings';

import { readPreferences } from '~/lib/preferences';

/** The preferences a user gets before changing any setting. */
export const SETTINGS = readPreferences(settings);
