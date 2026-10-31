import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchTypingIndicator } from '~/patches/typing-indicator';
import { Avatars, UserStore } from '~/modules';

function start() {
	if (!ensureModules('Typing Avatars', { Avatars, UserStore })) return;

	applyFeatures('Typing Avatars', [patchTypingIndicator]);
}

export default { start, selfTest: featureSelfTest };
