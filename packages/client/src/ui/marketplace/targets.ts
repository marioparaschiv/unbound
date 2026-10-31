import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';

import { installDependencies } from '~/ui/marketplace/install-dependencies';
import { Manager } from '~/managers/base';

/**
 * @description Reads the version of a listed addon that is installed on this device.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @returns The installed version, or `undefined` if absent.
 */
export function getInstalledVersion(kind: AddonKind, addon: ListedAddon): string | undefined {
	return Manager.for(kind).getInstalledVersion(addon);
}

/**
 * @description Installs one version of a listed addon through its manager. Plugins get their dependencies first.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @param version The version to install.
 * @param hold Whether automatic updates should leave the addon on this version.
 * @returns Whether the addon now runs the version.
 */
export async function installVersion(
	kind: AddonKind,
	addon: ListedAddon,
	version: AddonVersion,
	hold: boolean = false,
): Promise<boolean> {
	if (kind === 'plugin' && !(await installDependencies(version.manifest))) {
		return false;
	}

	return Manager.for(kind).installListed(addon, version, hold);
}

export default {
	getInstalledVersion,
	installVersion,
};
