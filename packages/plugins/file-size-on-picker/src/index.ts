import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMediaKeyboardItem } from '~/patches/media-keyboard-item';
import { createFileSizeLookup } from '~/file-sizes/platform';

function start(context: PluginContext) {
	patchMediaKeyboardItem(createFileSizeLookup(context));
	recordApplied(1);
}

export default { start, selfTest: featureSelfTest };
