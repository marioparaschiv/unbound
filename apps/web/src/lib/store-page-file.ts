import {
	splitFrontmatter,
	type AddonPage,
	type PublishedStorePage,
} from '@unbound-app/contracts/addon-page';

import { renderPageIcons } from '~/lib/page-icon-svgs';

/**
 * @description Builds a version's `store-page.json`: everything the app's store page draws, in one file.
 * @param addonMd The ADDON.md text, frontmatter included.
 * @param measured The measured page, or `null` when the version has none.
 * @returns The file's JSON text.
 */
export function buildStorePageFile(addonMd: string, measured: AddonPage | null): string {
	const { body } = splitFrontmatter(addonMd);
	const file: PublishedStorePage = { body, measured, icons: renderPageIcons(body) };

	return JSON.stringify(file);
}

export default { buildStorePageFile };
