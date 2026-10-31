import type { Tokens } from 'marked';
import { Lexer, walkTokens } from 'marked';

import type { AddonPageFrontmatter } from './addon-page';
import { mediaPathSchema } from './addon-page';

/**
 * @description Lists every media file ADDON.md shows, the set `ubd build` measures into `page.json`.
 * @param frontmatter The parsed frontmatter, or `undefined` when ADDON.md has none.
 * @param body The Markdown after the frontmatter.
 * @returns The banner, gallery and poster paths, then each valid `media/` image path in the body,
 * in order and without repeats.
 */
export function listPageMediaPaths(
	frontmatter: AddonPageFrontmatter | undefined,
	body: string,
): string[] {
	const paths = new Set<string>();

	if (frontmatter) {
		paths.add(frontmatter.banner);

		for (const entry of frontmatter.media) {
			if ('image' in entry) {
				paths.add(entry.image);

				continue;
			}

			paths.add(entry.video);

			if (entry.poster) {
				paths.add(entry.poster);
			}
		}
	}

	walkTokens(Lexer.lex(body), (token) => {
		if (token.type !== 'image') return;

		const { href } = token as Tokens.Image;

		if (mediaPathSchema.safeParse(href).success) {
			paths.add(href);
		}
	});

	return [...paths];
}

export default { listPageMediaPaths };
