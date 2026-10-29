import type { AddonType, AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';

import { installDependencies } from '~/ui/marketplace/install-dependencies';
import type { UpdatableKind } from '~/lib/updates';
import { toRelease } from '~/lib/addon-versions';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { Messages } from '~/api/i18n';

/** One marketplace tab: the manifest type it lists and the manager that installs it. */
export type MarketplaceTab = {
	type: AddonType;
	kind: ManagerKind;
	/** The tab label. */
	label: () => string;
	/** The asset shown on each card, in place of an addon icon. */
	icon: string;
};

/** Manager events after which an addon's installed version may differ. */
export const INSTALL_EVENTS = ['loaded', 'unloaded', 'installed', 'updated', 'deleted'] as const;

export const MARKETPLACE_TABS: MarketplaceTab[] = [
	{
		type: 'plugin',
		kind: ManagerKind.Plugins,
		label: () => Messages.UNBOUND_PLUGINS,
		icon: 'PuzzlePieceIcon',
	},
	{
		type: 'theme',
		kind: ManagerKind.Themes,
		label: () => Messages.UNBOUND_THEMES,
		icon: 'PaintPaletteIcon',
	},
	{
		type: 'icon-pack',
		kind: ManagerKind.Icons,
		label: () => Messages.UNBOUND_ICONS,
		icon: 'ImageIcon',
	},
	{
		type: 'font',
		kind: ManagerKind.Fonts,
		label: () => Messages.UNBOUND_FONTS,
		icon: 'LettersIcon',
	},
];

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
export function getInstalledVersion(kind: ManagerKind, addon: ListedAddon): string | undefined {
	if (kind === ManagerKind.Fonts) {
		const installed = getManager(kind)
			.getEntities()
			.some((font) => font.file === fontFile(addon));

		return installed ? addon.latestVersion.version : undefined;
	}

	return getManager(kind).getEntity(addon.id)?.data.version;
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
	if (kind === ManagerKind.Plugins && !(await installDependencies(version.manifest))) {
		return false;
	}

	const manager = getManager(kind);

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
	return Boolean(await getManager(ManagerKind.Fonts).install(addon.latestVersion.bundleUrl));
}

export default {
	INSTALL_EVENTS,
	MARKETPLACE_TABS,
	getInstalledVersion,
	installVersion,
	installFont,
};
