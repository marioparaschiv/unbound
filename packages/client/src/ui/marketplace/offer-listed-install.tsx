import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import { getInstallStatus } from '~/marketplace/catalog';
import { pickInstallVersion } from '~/addons/versions';
import { CLIENT_VERSION } from '~/core/constants';
import { Manager } from '~/addons/manager';
import { confirm } from '~/dialogs/api';
import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

const logger = createLogger('Marketplace', 'Link');

/**
 * @description Asks, in a dialog, whether to install or update a listed addon to the newest version this client runs, then does it. Skips a current addon.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon; its name, version, authors and description are shown.
 * @returns Whether the addon was installed or updated.
 */
export async function offerListedInstall(kind: AddonKind, addon: ListedAddon): Promise<boolean> {
	const manager = Manager.for(kind);
	const installed = manager.getInstalledVersion(addon);
	const picked = await pickInstallVersion(addon, installed, CLIENT_VERSION).catch(
		(cause: unknown) => {
			logger.error(`Failed to fetch the versions of ${addon.id}:`, cause);
		},
	);
	const { name } = addon.latestVersion.manifest;

	if (!picked) {
		failed(name);

		return false;
	}

	if (picked.type === 'incompatible') {
		show({
			title: name,
			content: format('UNBOUND_VERSION_NEEDS_CLIENT', { version: picked.requires }),
			icon: 'CircleXIcon',
		});

		return false;
	}

	const { description, version, authors } = picked.version.manifest;
	const status = getInstallStatus(version, installed);

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

	const ok = await manager.installListed(addon, picked.version);

	if (!ok) {
		failed(name);
	}

	return ok;
}

function failed(name: string) {
	show({
		title: name,
		content: format('UNBOUND_INSTALL_FAILED', { name }),
		icon: 'CircleXIcon',
	});
}
