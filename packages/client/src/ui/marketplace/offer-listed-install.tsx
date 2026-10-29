import type { ListedAddon } from '@unbound-app/contracts/addons';

import { Discord } from '~/api/metro/components';
import { getInstallStatus } from '~/lib/catalog';
import { ManagerKind } from '~/lib/constants';
import { showToast } from '~/api/toasts';
import { format } from '~/api/i18n';

import { getInstalledVersion, installFont, installVersion } from './targets';

const ALERT_KEY = 'unbound-offer-listed-install';

function confirm(addon: ListedAddon, update: boolean): Promise<boolean> {
	const { name, description, version, authors } = addon.latestVersion.manifest;

	return new Promise((resolve) => {
		let answered = false;

		function answer(confirmed: boolean) {
			if (answered) return;

			answered = true;
			Discord.dismissAlert(ALERT_KEY);
			resolve(confirmed);
		}

		Discord.openAlert(
			ALERT_KEY,
			<Discord.AlertModal
				title={format(update ? 'UNBOUND_LINK_UPDATE_TITLE' : 'UNBOUND_LINK_INSTALL_TITLE', {
					name,
				})}
				content={format('UNBOUND_LINK_BODY', {
					version,
					authors: authors.map((author) => author.name).join(', '),
					description,
				})}
				actions={
					<>
						<Discord.AlertActionButton
							text={format(update ? 'UNBOUND_UPDATE' : 'UNBOUND_INSTALL')}
							variant='primary'
							onPress={() => answer(true)}
						/>
						<Discord.AlertActionButton
							text={format('UNBOUND_CANCEL')}
							variant='secondary'
							onPress={() => answer(false)}
						/>
					</>
				}
			/>,
		);
	});
}

/**
 * @description Asks, in an alert, whether to install or update a listed addon, then does it. Skips a current addon.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon; its name, version, authors and description are shown.
 * @returns Whether the addon was installed or updated.
 */
export async function offerListedInstall(kind: ManagerKind, addon: ListedAddon): Promise<boolean> {
	const { name } = addon.latestVersion.manifest;
	const status = getInstallStatus(addon.latestVersion.version, getInstalledVersion(kind, addon));

	if (status === 'installed' || !(await confirm(addon, status === 'update'))) {
		return false;
	}

	const ok =
		kind === ManagerKind.Fonts
			? await installFont(addon)
			: await installVersion(kind, addon, addon.latestVersion);

	if (!ok) {
		showToast({
			title: name,
			content: format('UNBOUND_INSTALL_FAILED', { name }),
			icon: 'CircleXIcon',
		});
	}

	return ok;
}

export default { offerListedInstall };
