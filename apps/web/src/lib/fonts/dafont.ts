import type { FontSource } from './font-source';

import { familyFromSlug } from './font-file-kind';

/** A dafont page slug, such as `bebas-neue` in `dafont.com/bebas-neue.font`. */
const DAFONT_SLUG = /^([a-z\d]+(?:-[a-z\d]+)*)\.font$/;

/**
 * dafont: a font page becomes its zip download. dafont lists no API, so the family name comes from
 * the slug, and an unknown slug only fails when the loader finds no font in the download.
 */
const dafont: FontSource = {
	provider: 'dafont',
	match(url) {
		if (url.hostname !== 'www.dafont.com' && url.hostname !== 'dafont.com') return;

		return DAFONT_SLUG.exec(url.pathname.slice(1))?.[1];
	},
	async resolve(id) {
		return {
			provider: 'dafont',
			id,
			family: familyFromSlug(id),
			files: [
				{
					url: `https://dl.dafont.com/dl/?f=${id.replaceAll('-', '_')}`,
					kind: 'archive',
					weight: null,
					style: null,
				},
			],
		};
	},
};

export default dafont;
