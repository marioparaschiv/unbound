import type { FontSource } from './font-source';

import { familyFromSlug } from './font-file-kind';

/** A Font Squirrel slug, such as `open-sans`. */
const FONTSQUIRREL_SLUG = /^[a-z\d]+(?:-[a-z\d]+)*$/;

// Its API sits behind a bot challenge that blocks servers after a few requests, so nothing is
// fetched; an unknown slug only fails when the loader finds no font in the download.
/** Font Squirrel: a font page becomes the family's zip download. */
const fontsquirrel: FontSource = {
	provider: 'fontsquirrel',
	match(url) {
		if (url.hostname !== 'www.fontsquirrel.com' && url.hostname !== 'fontsquirrel.com') return;

		const segments = url.pathname.split('/').filter(Boolean);
		const slug = segments[0] === 'fonts' ? segments.at(-1) : undefined;

		return slug && slug !== 'download' && FONTSQUIRREL_SLUG.test(slug) ? slug : undefined;
	},
	async resolve(id) {
		return {
			provider: 'fontsquirrel',
			id,
			family: familyFromSlug(id),
			files: [
				{
					url: `https://www.fontsquirrel.com/fonts/download/${id}`,
					kind: 'archive',
					weight: null,
					style: null,
				},
			],
		};
	},
};

export default fontsquirrel;
