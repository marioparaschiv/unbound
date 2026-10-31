import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';

import { patchMediaShareActions } from '~/patches/media-share-actions';
import { patchMediaManager } from '~/patches/media-manager';

function start() {
	patchMediaShareActions();
	patchMediaManager();
	recordApplied(2);
}

export default { start, selfTest: featureSelfTest };
