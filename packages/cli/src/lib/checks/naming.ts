import { validateAddonNaming } from '@unbound-app/contracts/addon-conventions';
import { MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import { basename } from 'node:path';

import { diagnostic } from '~/lib/check/diagnostic';
import { readDevManifest } from '~/lib/manifest';
import type { Check } from '~/lib/check/check';

export const namingCheck: Check = {
	id: 'naming',
	/**
	 * @description Checks the addon's manifest naming, and its folder when the workspace chose it.
	 * @param context The addon to check.
	 * @returns One warning per naming problem.
	 */
	run({ addon }) {
		const isBareRepository = addon.path === '';
		const folder = isBareRepository ? void 0 : basename(addon.dir);

		return validateAddonNaming(readDevManifest(addon.dir), folder).map((message) =>
			diagnostic({ file: MANIFEST_FILENAME, severity: 'warning', message }),
		);
	},
};

export default namingCheck;
