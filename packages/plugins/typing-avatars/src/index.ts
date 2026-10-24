import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchTypingIndicator } from '~/patches/typing-indicator';
import { Avatars, UserStore } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Typing Avatars', { Avatars, UserStore })) return;

	dispose = applyFeatures('Typing Avatars', [patchTypingIndicator]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
