import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';

import { installDependencies } from '~/ui/marketplace/install-dependencies';
import type { UpdatableKind } from '~/lib/updates';
import { toRelease } from '~/lib/addon-versions';
import { Manager } from '~/managers/base';

/** Manager events after which an addon's installed version may differ. */
export const INSTALL_EVENTS = ['loaded', 'unloaded', 'installed', 'updated', 'deleted'] as const;

// A font installs as its bare file, named after the bundle, with no manifest to version it.
function fontFile(addon: ListedAddon): string {
	return addon.latestVersion.bundleUrl.split('/').pop() ?? '';
}

/**
 * @description Reads the version of a listed addon that is installed on this device.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @returns The installed version, the listed one for an installed font, or `undefined` if absent.
 */
export function getInstalledVersion(kind: AddonKind, addon: ListedAddon): string | undefined {
	if (kind === 'font') {
		const installed = Manager.for(kind)
			.getEntities()
			.some((font) => font.file === fontFile(addon));

		return installed ? addon.latestVersion.version : undefined;
	}

	return Manager.for(kind).getEntity(addon.id)?.data.version;
}

/**
 * @description Installs one version of a listed addon, newer or older than the installed one, then
 * holds it there or lets automatic updates move it on. Plugins get their dependencies first.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @param version The version to install.
 * @param hold Whether automatic updates should leave the addon on this version.
 * @returns Whether the addon now runs the version.
 */
export async function installVersion(
	kind: UpdatableKind,
	addon: ListedAddon,
	version: AddonVersion,
	hold: boolean = false,
): Promise<boolean> {
	if (kind === 'plugin' && !(await installDependencies(version.manifest))) {
		return false;
	}

	const manager = Manager.for(kind);

	if (manager.getEntity(addon.id)) {
		await manager.update(addon.id, toRelease(addon.id, version));
	} else {
		await manager.install(version.manifestUrl);
	}

	if (manager.getEntity(addon.id)?.data.version !== version.version) {
		return false;
	}

	if (hold) {
		manager.holdVersion(addon.id, version.version);
	} else {
		manager.releaseHold(addon.id);
	}

	return true;
}

/**
 * @description Installs a listed font as its bare file; fonts carry no manifest or version to choose.
 * @param addon The listed font.
 * @returns Whether the install succeeded.
 */
export async function installFont(addon: ListedAddon): Promise<boolean> {
	return Boolean(await Manager.for('font').install(addon.latestVersion.bundleUrl));
}

export default {
	INSTALL_EVENTS,
	getInstalledVersion,
	installVersion,
	installFont,
};
