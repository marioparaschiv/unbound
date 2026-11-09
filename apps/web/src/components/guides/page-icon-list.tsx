import { ADDON_PAGE_ICON_NAMES } from '@unbound-app/contracts/addon-page-icons';

import { ADDON_PAGE_ICONS } from '~/lib/page-icons';

/**
 * @description Every icon an ADDON.md may name, each with the shortcode that draws it, generated from the set the store renders.
 * @returns The icon grid.
 */
function PageIconList() {
	return (
		<ul className='gap-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'>
			{ADDON_PAGE_ICON_NAMES.map((name) => {
				const Glyph = ADDON_PAGE_ICONS[name];

				return (
					<li
						key={name}
						className='flex items-center gap-2.5 bg-card px-3 py-2 border rounded-control min-w-0'
					>
						<Glyph size={16} aria-hidden className='text-primary shrink-0' />
						<span className='font-mono text-foreground text-sm break-all'>
							:{name}:
						</span>
					</li>
				);
			})}
		</ul>
	);
}

export default PageIconList;
