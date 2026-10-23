import type { AddonType, ListedAddon } from '@unbound-app/contracts/addons';

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
 * @description Installs a listed addon's newest version through its manager.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @returns Whether the install succeeded.
 */
export async function installListed(kind: ManagerKind, addon: ListedAddon): Promise<boolean> {
	const { manifestUrl, bundleUrl } = addon.latestVersion;

	if (kind === ManagerKind.Fonts) {
		return Boolean(await getManager(kind).install(bundleUrl));
	}

	return Boolean(await getManager(kind).install(manifestUrl));
}

/**
 * @description Updates an installed addon to its listed newest version, verifying the bundle hash.
 * @param kind The manager the addon belongs to; fonts carry no version and never update.
 * @param addon The listed addon.
 * @returns Whether the update succeeded.
 */
export async function updateListed(kind: ManagerKind, addon: ListedAddon): Promise<boolean> {
	if (kind === ManagerKind.Fonts) {
		return false;
	}

	const manager = getManager(kind);
	const { version, manifestUrl, bundleUrl, sha256, changelog } = addon.latestVersion;

	await manager.update(addon.id, {
		id: addon.id,
		version,
		manifestUrl,
		bundleUrl,
		sha256,
		changelog,
	});

	return manager.getEntity(addon.id)?.data.version === version;
}

export default {
	INSTALL_EVENTS,
	MARKETPLACE_TABS,
	getInstalledVersion,
	installListed,
	updateListed,
};
