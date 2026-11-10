import { safeParse, Type } from '@unbound-app/contracts/schema';

import type { FontFetch, FontSource } from './font-source';

import { requestFontSource } from './font-request';
import { readFontFaces } from './font-face-css';

/** Every weight, upright then italic. Google answers with only the ones the family has. */
const VARIANTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
	.flatMap((weight) => [`${weight}`, `${weight}i`])
	.join(',');

/** A Google family name: letters, digits and single spaces, such as `Noto Sans JP`. */
export const GOOGLE_FAMILY = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;

const catalogFamilySchema = Type.Object({ family: Type.String({ minLength: 1 }) });

function familyFrom(value: string | null | undefined): string | undefined {
	const family = value?.split(/[:|]/)[0]?.replaceAll('+', ' ').trim();

	return family && GOOGLE_FAMILY.test(family) ? family : undefined;
}

async function requestFaces(family: string, fetch: FontFetch) {
	const response = await requestFontSource(
		fetch,
		'google',
		`https://fonts.googleapis.com/css?family=${family.replaceAll(' ', '+')}:${VARIANTS}`,
	);

	if (!response) return;

	const faces = readFontFaces(await response.text());

	return faces.files.length > 0 ? faces : undefined;
}

/**
 * Google matches family names case-sensitively, so `inter` misses `Inter`. Fontsource mirrors Google's catalogue
 * under lowercase ids and answers with the family's real spelling, such as `JetBrains Mono`.
 */
async function canonicalFamily(family: string, fetch: FontFetch): Promise<string | undefined> {
	const id = family.toLowerCase().replaceAll(' ', '-');

	try {
		const response = await requestFontSource(
			fetch,
			'fontsource',
			`https://api.fontsource.org/v1/fonts/${id}`,
		);
		const parsed = response && safeParse(catalogFamilySchema, await response.json());
		const found = parsed?.success ? parsed.data.family : undefined;

		return found && found !== family && GOOGLE_FAMILY.test(found) ? found : undefined;
	} catch {
		// The lookup only rescues a miscased name; when Fontsource is down, the name stays not found.
		return undefined;
	}
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
		const faces = await requestFaces(id, fetch);

		if (faces) {
			return { provider: 'google', id, family: faces.family ?? id, files: faces.files };
		}

		const family = await canonicalFamily(id, fetch);
		const found = family ? await requestFaces(family, fetch) : undefined;

		if (!family || !found) return;

		return {
			provider: 'google',
			id: family,
			family: found.family ?? family,
			files: found.files,
		};
	},
};

export default googleFonts;
