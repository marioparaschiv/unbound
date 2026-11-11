import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startShareActions } from '~/share';
import { startDownloads } from '~/download';

export const { start, stop, selfTest } = runFeatures([startShareActions, startDownloads]);
