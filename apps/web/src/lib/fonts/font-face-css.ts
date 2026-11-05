import type { FontFile, FontStyle } from '@unbound-app/contracts/fonts';

const FONT_FACE = /@font-face\s*\{([^}]*)\}/g;
const FAMILY = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/;
const STYLE = /font-style:\s*(normal|italic)\s*;/;
// One weight only: a range such as `300 900` marks a variable font, which the loader cannot pick a weight from yet.
const WEIGHT = /font-weight:\s*(\d{3})\s*;/;
const SOURCE = /url\(\s*['"]?([^'")]+\.(?:ttf|otf))['"]?\s*\)/;

export type FontFaces = {
	family: string | undefined;
	files: FontFile[];
};

/**
 * @description Reads the static `.ttf`/`.otf` faces from a stylesheet's `@font-face` rules, one per
 * weight and style. Protocol-relative URLs read as `https:`; plain `http:` faces are skipped.
 * @param css The stylesheet.
 * @returns The first rule's family and every face found.
 */
export function readFontFaces(css: string): FontFaces {
	const files = new Map<string, FontFile>();
	let family: string | undefined;

	for (const [, rule = ''] of css.matchAll(FONT_FACE)) {
		const weight = WEIGHT.exec(rule)?.[1];
		const source = SOURCE.exec(rule)?.[1];
		const url = source?.startsWith('//') ? `https:${source}` : source;

		if (!weight || !url?.startsWith('https://')) {
			continue;
		}

		const style: FontStyle = STYLE.exec(rule)?.[1] === 'italic' ? 'italic' : 'normal';
		const key = `${weight}-${style}`;

		family ??= FAMILY.exec(rule)?.[1]?.trim();

		if (files.has(key)) {
			continue;
		}

		files.set(key, {
			url,
			kind: 'font',
			weight: Number(weight),
			style,
		});
	}

	return { family, files: [...files.values()] };
}

export default { readFontFaces };
