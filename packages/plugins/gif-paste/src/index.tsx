import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { gifPasteFeatures } from '~/gif-paste';

export const { start, stop, selfTest } = runFeatures(gifPasteFeatures);
