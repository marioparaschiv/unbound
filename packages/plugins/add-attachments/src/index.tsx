import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startEditUploads } from '~/editing';
import { startSheet } from '~/sheet';

export const { start, stop, selfTest } = runFeatures([startEditUploads, startSheet]);
