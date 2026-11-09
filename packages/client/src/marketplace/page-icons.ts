import {
	ADDON_PAGE_ICON_NAMES,
	type AddonPageIconName,
} from '@unbound-app/contracts/addon-page-icons';

const NAMES = new Set<string>(ADDON_PAGE_ICON_NAMES);

/**
 * @description Checks a `:name:` shortcode against the icons an ADDON.md may use.
 * @param name The kebab-case name between the colons.
 * @returns Whether the name is a page icon.
 */
export function isPageIcon(name: string): name is AddonPageIconName {
	return NAMES.has(name);
}

export default { isPageIcon };
