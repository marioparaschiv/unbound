import type { FontFile, FontStyle } from '@unbound-app/contracts/fonts';

const FONT_FACE = /@font-face\s*\{([^}]*)\}/g;
const FAMILY = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/;
const STYLE = /font-style:\s*(normal|italic)\s*;/;
// A range such as `300 900` marks a variable font.
const WEIGHT = /font-weight:\s*(\d{1,4})(\s+\d{1,4})?\s*;/;
const SOURCE = /url\(\s*['"]?([^'")]+\.(ttf|otf|woff2|woff))['"]?\s*\)/g;
// The loader decodes web fonts on the device, so a plain sfnt file saves it the work.
const FORMAT_RANK: Record<string, number> = { ttf: 0, otf: 0, woff2: 1, woff: 2 };

export type FontFaces = {
	family: string | undefined;
	files: FontFile[];
};

function sourceOf(rule: string): string | undefined {
	const sources = [...rule.matchAll(SOURCE)]
		.map(([, url = '', format = '']) => ({
			url: url.startsWith('//') ? `https:${url}` : url,
			rank: FORMAT_RANK[format.toLowerCase()] ?? 3,
		}))
		.filter(({ url }) => url.startsWith('https://'))
		.sort((a, b) => a.rank - b.rank);

	return sources[0]?.url;
}

/**
 * @description Reads the faces from a stylesheet's `@font-face` rules, one per weight and style, preferring
 * `.ttf`/`.otf` over `.woff2`/`.woff`. A variable face (a weight range) is kept, with a `null` weight, only for
 * a style no static face covers. Protocol-relative URLs read as `https:`; plain `http:` faces are skipped.
 * @param css The stylesheet.
 * @returns The first rule's family and every face found.
 */
export function readFontFaces(css: string): FontFaces {
	const files = new Map<string, FontFile>();
	const variable = new Map<FontStyle, FontFile>();
	let family: string | undefined;

	for (const [, rule = ''] of css.matchAll(FONT_FACE)) {
		const [, weight, range] = WEIGHT.exec(rule) ?? [];
		const url = sourceOf(rule);

		if (!weight || !url) {
			continue;
		}

		const style: FontStyle = STYLE.exec(rule)?.[1] === 'italic' ? 'italic' : 'normal';
		const key = `${weight}-${style}`;

		family ??= FAMILY.exec(rule)?.[1]?.trim();

		if (range) {
			if (!variable.has(style)) {
				variable.set(style, { url, kind: 'font', weight: null, style });
			}

			continue;
		}

		if (files.has(key)) {
			continue;
		}

		files.set(key, { url, kind: 'font', weight: Number(weight), style });
	}

	const statics = [...files.values()];
	const styles = new Set(statics.map((file) => file.style));
	const variables = [...variable.values()].filter((file) => !styles.has(file.style));

	return { family, files: [...statics, ...variables] };
}

export default { readFontFaces };
