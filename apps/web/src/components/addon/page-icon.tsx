import type { AddonPageIconName } from '@unbound-app/contracts/addon-page-icons';
import type { ReactNode } from 'react';

import { ADDON_PAGE_ICONS } from '~/lib/page-icons';

function isPageIcon(name: string): name is AddonPageIconName {
	return Object.hasOwn(ADDON_PAGE_ICONS, name);
}

/**
 * @description Renders an ADDON.md `:name:` shortcode as its icon, in the brand colour at text size.
 * @param name The kebab-case icon name between the colons.
 * @param key The React key among its siblings.
 * @returns The icon, or `undefined` when the name is not in the set, so the text stays as written.
 */
export function renderPageIcon(name: string, key: number): ReactNode | undefined {
	if (!isPageIcon(name)) {
		return undefined;
	}

	const Glyph = ADDON_PAGE_ICONS[name];

	return (
		<Glyph
			key={key}
			size='1em'
			aria-hidden
			className='inline-block text-primary align-[-0.125em]'
		/>
	);
}

export default { renderPageIcon };
