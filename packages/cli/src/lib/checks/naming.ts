import { validateAddonNaming } from '@unbound-app/contracts/addon-conventions';
import { basename } from 'node:path';

import type { BuildCheck } from '~/lib/build-checks';
import { readDevManifest } from '~/lib/manifest';

/** Warns when an addon's folder, id, name or description breaks the naming conventions. */
export const namingCheck: BuildCheck = {
	name: 'naming',
	/**
	 * @description Checks the addon's manifest naming, and its folder when the workspace chose it.
	 * @param addon The addon to check.
	 * @returns One warning per naming problem.
	 */
	run(addon) {
		// A bare repository's folder is wherever it was cloned, so only a workspace folder is checked.
		const folder = addon.path ? basename(addon.dir) : void 0;

		return validateAddonNaming(readDevManifest(addon.dir), folder).map((message) => ({
			severity: 'warning',
			message,
		}));
	},
};

export default namingCheck;
