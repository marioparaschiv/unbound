import type { FontSource } from './font-source';

import { requestFontSource } from './font-request';
import { readFontFaces } from './font-face-css';

/** A Fontshare slug, such as `satoshi` or `general-sans`. */
const FONTSHARE_SLUG = /^[a-z\d]+(?:-[a-z\d]+)*$/;

/** Fontshare (Indian Type Foundry): font pages, resolved through its CSS API's static faces. */
const fontshare: FontSource = {
	provider: 'fontshare',
	match(url) {
		if (url.hostname !== 'fontshare.com' && url.hostname !== 'www.fontshare.com') return;

		const [, page, slug] = url.pathname.split('/');

		return page === 'fonts' && slug && FONTSHARE_SLUG.test(slug) ? slug : undefined;
	},
	async resolve(id, fetch) {
		const response = await requestFontSource(
			fetch,
			'fontshare',
			`https://api.fontshare.com/v2/css?f[]=${id}@all`,
		);

		if (!response) return;

		// An unknown slug answers 200 with no faces.
		const faces = readFontFaces(await response.text());

		if (faces.files.length === 0) return;

		return { provider: 'fontshare', id, family: faces.family ?? id, files: faces.files };
	},
};

export default fontshare;
