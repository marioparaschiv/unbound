/** The file in an addon's directory that holds its store page. */
export const ADDON_PAGE_FILENAME = 'ADDON.md';

/** The file `ubd build` writes the measured page to, in the addon's output directory. */
export const MEASURED_PAGE_FILENAME = 'page.json';

/** The file the app's store page reads in one request: ADDON.md's body, the measured page and each icon's SVG. */
export const STORE_PAGE_FILENAME = 'store-page.json';

const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** ADDON.md cut at its frontmatter fences. */
export type SplitAddonPage = {
	/** The YAML between the `---` fences, or `undefined` when the file has none. */
	frontmatter: string | undefined;
	body: string;
};

/**
 * @description Cuts ADDON.md into its YAML frontmatter and its Markdown body.
 * @param source The file's text.
 * @returns The YAML between the leading `---` fences and the Markdown after them.
 */
export function splitFrontmatter(source: string): SplitAddonPage {
	const match = FRONTMATTER.exec(source);

	if (!match) {
		return { frontmatter: undefined, body: source };
	}

	return { frontmatter: match[1] ?? '', body: source.slice(match[0].length) };
}

export default {
	ADDON_PAGE_FILENAME,
	MEASURED_PAGE_FILENAME,
	STORE_PAGE_FILENAME,
	splitFrontmatter,
};
