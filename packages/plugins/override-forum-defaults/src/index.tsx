import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startForumDefaults } from '~/forum-defaults';

export function start() {
	startForumDefaults();
}

export { featureSelfTest as selfTest };
