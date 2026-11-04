import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startTypingAvatars } from '~/typing-avatars';

export function start() {
	startTypingAvatars();
}

export { featureSelfTest as selfTest };
