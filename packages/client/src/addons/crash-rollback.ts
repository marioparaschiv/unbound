import { minimumClientVersion } from '@unbound-app/contracts/client-version-reset';
import type { AddonVersion } from '@unbound-app/contracts/addons';

import { compareVersions } from '~/core/versions';
import type { Addon } from '~/addons/addon';

/**
 * @description Picks the version to roll a crashing addon back to: the newest listed version older than the one that
 * crashed that this client can run.
 * @param versions The addon's listed versions, newest first.
 * @param crashed The version that crashed.
 * @param clientVersion This client's version, compared with each manifest's `unbound.min`.
 * @returns The version, or `undefined` when there is nothing older to go back to.
 */
export function rollbackVersion(
	versions: AddonVersion[],
	crashed: string,
	clientVersion: string,
): AddonVersion | undefined {
	return versions.find((version) => {
		const min = minimumClientVersion(version.manifest.unbound?.min);

		return (
			compareVersions(version.version, crashed) < 0 &&
			(!min || compareVersions(min, clientVersion) <= 0)
		);
	});
}

/**
 * @description After the crash guard turned a marketplace plugin off, installs its previous listed version, holds
 * updates there and turns it back on, so a bad update costs the feature for one launch instead of until the next
 * release. Does nothing for plugins with no older version, or that aren't listed.
 * @param addon The plugin the crash guard disabled.
 * @returns Whether it was rolled back.
 */
export async function rollBackCrashedPlugin(addon: Addon): Promise<boolean> {
	try {
		const { Manager } = await import('~/addons/manager');
		const { fetchAddonVersions } = await import('~/addons/versions');
		const { CLIENT_VERSION } = await import('~/core/constants');
		const plugins = Manager.for('plugin');

		if (plugins.getAddon(addon.id) !== addon) {
			return false;
		}

		const previous = rollbackVersion(
			await fetchAddonVersions(addon.id),
			addon.version,
			CLIENT_VERSION,
		);

		if (
			!previous ||
			!(await plugins.installListed({ id: addon.id }, previous, { hold: true }))
		) {
			return false;
		}

		await plugins.enable(addon.id);

		const { show } = await import('~/toasts/api');

		show({
			title: addon.name,
			content: `Rolled ${addon.name} back to ${previous.version} after ${addon.version} crashed Discord; updates for it are paused until you pick a version.`,
		});

		return true;
	} catch {
		return false;
	}
}
