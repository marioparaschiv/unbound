import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';

import { getInstalledVersion, installVersion } from '~/marketplace/install';
import { getInstallStatus } from '~/marketplace/catalog';
import { confirm } from '~/dialogs/api';
import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

/**
 * @description Asks, in a dialog, whether to install or update a listed addon, then does it. Skips a current addon.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon; its name, version, authors and description are shown.
 * @returns Whether the addon was installed or updated.
 */
export async function offerListedInstall(kind: AddonKind, addon: ListedAddon): Promise<boolean> {
	const { name, description, version, authors } = addon.latestVersion.manifest;
	const status = getInstallStatus(version, getInstalledVersion(kind, addon));

	if (status === 'installed') {
		return false;
	}

	const update = status === 'update';
	const approved = await confirm(
		update ? 'UNBOUND_LINK_UPDATE_TITLE' : 'UNBOUND_LINK_INSTALL_TITLE',
		{
			titleVars: { name },
			body: 'UNBOUND_LINK_BODY',
			bodyVars: {
				version,
				authors: authors.map((author) => author.name).join(', '),
				description,
			},
			confirm: update ? 'UNBOUND_UPDATE' : 'UNBOUND_INSTALL',
		},
	);

	if (!approved) {
		return false;
	}

	const ok = await installVersion(kind, addon, addon.latestVersion);

	if (!ok) {
		show({
			title: name,
			content: format('UNBOUND_INSTALL_FAILED', { name }),
			icon: 'CircleXIcon',
		});
	}

	return ok;
}
