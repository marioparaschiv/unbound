import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';

import { installDependencies } from '~/marketplace/install-dependencies';
import { countInstall } from '~/marketplace/count-install';
import { Manager } from '~/addons/manager';

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
 * @description Installs one version of a listed addon through its manager, enabling it on a first install.
 * Plugins get their dependencies first. A first install is counted anonymously.
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

	const manager = Manager.for(kind);
	const fresh = !manager.getInstalledVersion(addon);

	if (!(await manager.installListed(addon, version, hold))) {
		return false;
	}

	if (fresh) {
		countInstall(addon.id);
	}

	// Updates keep the user's choice; only a new install turns itself on. Fonts have no on state, so they apply from Design.
	if (fresh && 'enable' in manager) {
		await manager.enable(addon.id);
	}

	return true;
}
