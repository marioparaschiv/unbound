import { validateAddonCapabilities } from '@unbound-app/contracts/addon-conventions';

import type { BuildCheck } from '~/lib/build-checks';
import { readDevManifest } from '~/lib/manifest';

export const capabilitiesCheck: BuildCheck = {
	name: 'capabilities',
	/**
	 * @description Checks the addon's declared platforms and Capabilities.
	 * @param addon The addon to check.
	 * @returns One error per Capability or platform the client cannot grant.
	 */
	run(addon) {
		return validateAddonCapabilities(readDevManifest(addon.dir)).map((message) => ({
			severity: 'error',
			message,
		}));
	},
};

export default capabilitiesCheck;
