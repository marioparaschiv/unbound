import type { AddonManifest } from '@unbound-app/types';

import { installUses, type InstallUse } from '~/marketplace/install-uses';
import { confirm } from '~/dialogs/api';
import { format } from '~/i18n/api';

function useLine(use: InstallUse): string {
	return use.key === 'UNBOUND_INSTALL_REVIEW_HOSTS'
		? format(use.key, { hosts: use.hosts })
		: format(use.key);
}

/**
 * @description Asks the user to confirm an install when the addon will connect to hosts or reach native code, and
 * lets every other install through without a dialog.
 * @param name The addon's name.
 * @param manifest The version about to install.
 * @returns Whether to install it.
 */
export function reviewInstall(name: string, manifest: AddonManifest): Promise<boolean> {
	const uses = installUses(manifest);

	if (!uses.length) {
		return Promise.resolve(true);
	}

	return confirm('UNBOUND_INSTALL_REVIEW_TITLE', {
		titleVars: { name },
		body: 'UNBOUND_INSTALL_REVIEW_BODY',
		bodyVars: { name, uses: uses.map(useLine).join('\n') },
		confirm: 'UNBOUND_INSTALL',
	});
}

export default reviewInstall;
