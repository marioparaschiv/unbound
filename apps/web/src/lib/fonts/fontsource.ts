import { safeParse, Type } from '@unbound-app/contracts/schema';
import type { FontFile } from '@unbound-app/contracts/fonts';

import type { FontSource } from './font-source';

import { requestFontSource } from './font-request';

/** A Fontsource id, such as `inter` or `jetbrains-mono`. Bunny Fonts uses the same ids. */
const FONTSOURCE_ID = /^[a-z\d]+(?:-[a-z\d]+)*$/;

const subsetFilesSchema = Type.Record(
	Type.String(),
	Type.Object({ url: Type.Object({ ttf: Type.Optional(Type.String()) }) }),
);

const fontsourceFontSchema = Type.Object({
	family: Type.String({ minLength: 1 }),
	defSubset: Type.String(),
	// weight → style → subset → `url` → file URL by format.
	variants: Type.Record(Type.String(), Type.Record(Type.String(), subsetFilesSchema)),
});

function idFrom(value: string | null | undefined): string | undefined {
	const id = value?.split(':')[0]?.trim().toLowerCase();

	return id && FONTSOURCE_ID.test(id) ? id : undefined;
}

/**
 * Fontsource, and Bunny Fonts, which serves Fontsource's files under the same ids. Its `.ttf` files
 * hold the family's default subset only, usually Latin; other scripts fall back to Discord's font.
 */
const fontsource: FontSource = {
	provider: 'fontsource',
	match(url) {
		const [, first, second] = url.pathname.split('/');

		switch (url.hostname) {
			case 'fontsource.org':
				return first === 'fonts' ? idFrom(second) : undefined;
			case 'fonts.bunny.net':
				if (first === 'family') {
					return idFrom(second);
				}

				return first === 'css' || first === 'css2'
					? idFrom(url.searchParams.get('family'))
					: undefined;
			default:
				return undefined;
		}
	},
	async resolve(id, fetch) {
		const response = await requestFontSource(
			fetch,
			'fontsource',
			`https://api.fontsource.org/v1/fonts/${id}`,
		);

		if (!response) return;

		const parsed = safeParse(fontsourceFontSchema, await response.json());

		if (!parsed.success) return;

		const { family, defSubset, variants } = parsed.data;
		const files: FontFile[] = [];

		for (const [weight, styles] of Object.entries(variants)) {
			for (const [style, subsets] of Object.entries(styles)) {
				const url = subsets[defSubset]?.url.ttf;

				if (!url?.startsWith('https://') || (style !== 'normal' && style !== 'italic')) {
					continue;
				}

				files.push({ url, kind: 'font', weight: Number(weight), style });
			}
		}

		if (files.length === 0) return;

		return { provider: 'fontsource', id, family, files };
	},
};

export default fontsource;
