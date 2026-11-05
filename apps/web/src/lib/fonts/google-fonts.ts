import type { FontSource } from './font-source';

import { requestFontSource } from './font-request';
import { readFontFaces } from './font-face-css';

/** Every weight, upright then italic. Google answers with only the ones the family has. */
const VARIANTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
	.flatMap((weight) => [`${weight}`, `${weight}i`])
	.join(',');

/** A Google family name: letters, digits and single spaces, such as `Noto Sans JP`. */
export const GOOGLE_FAMILY = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;

function familyFrom(value: string | null | undefined): string | undefined {
	const family = value?.split(/[:|]/)[0]?.replaceAll('+', ' ').trim();

	return family && GOOGLE_FAMILY.test(family) ? family : undefined;
}

/** Google Fonts: specimen pages and `css`/`css2` stylesheet links, resolved through the legacy CSS API. */
const googleFonts: FontSource = {
	provider: 'google',
	match(url) {
		if (url.hostname === 'fonts.google.com') {
			const [, page, name] = url.pathname.split('/');

			return page === 'specimen' ? familyFrom(decodeURIComponent(name ?? '')) : undefined;
		}

		if (url.hostname === 'fonts.googleapis.com' && /^\/css2?$/.test(url.pathname)) {
			return familyFrom(url.searchParams.get('family'));
		}

		return undefined;
	},
	async resolve(id, fetch) {
		const family = id.replaceAll(' ', '+');
		const response = await requestFontSource(
			fetch,
			'google',
			`https://fonts.googleapis.com/css?family=${family}:${VARIANTS}`,
		);

		if (!response) return;

		const faces = readFontFaces(await response.text());

		if (faces.files.length === 0) return;

		return { provider: 'google', id, family: faces.family ?? id, files: faces.files };
	},
};

export default googleFonts;
