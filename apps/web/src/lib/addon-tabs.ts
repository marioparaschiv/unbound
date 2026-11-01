import type { AddonType } from '@unbound-app/contracts/addons';

/** A tab of the `/addons` listing: one addon type on its own path. */
export type AddonTab = {
	type: AddonType;
	label: string;
	path: '/addons/plugins' | '/addons/themes' | '/addons/icons';
};

export const ADDON_TABS: AddonTab[] = [
	{ type: 'plugin', label: 'Plugins', path: '/addons/plugins' },
	{ type: 'theme', label: 'Themes', path: '/addons/themes' },
	{ type: 'icon-pack', label: 'Icons', path: '/addons/icons' },
];

/**
 * @description Finds the addons tab a path belongs to.
 * @param pathname The URL's path.
 * @returns The tab, or `undefined` outside the addon listings.
 */
export function getAddonTab(pathname: string): AddonTab | undefined {
	return ADDON_TABS.find((tab) => pathname === tab.path);
}

export default { ADDON_TABS, getAddonTab };
