import { validateAddonNaming } from '@unbound-app/contracts/addon-conventions';
import { basename } from 'node:path';

import type { BuildCheck } from '~/lib/build-checks';
import { readDevManifest } from '~/lib/manifest';

export const namingCheck: BuildCheck = {
	name: 'naming',
	/**
	 * @description Checks the addon's manifest naming, and its folder when the workspace chose it.
	 * @param addon The addon to check.
	 * @returns One warning per naming problem.
	 */
	run(addon) {
		const isBareRepository = addon.path === '';
		const folder = isBareRepository ? void 0 : basename(addon.dir);

		return validateAddonNaming(readDevManifest(addon.dir), folder).map((message) => ({
			severity: 'warning',
			message,
		}));
	},
};

export default namingCheck;
