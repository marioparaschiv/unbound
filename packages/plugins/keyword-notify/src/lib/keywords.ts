export type KeywordOptions = {
	keywords: readonly string[];
	regex: boolean;
	caseSensitive: boolean;
	wholeWords: boolean;
};

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

function patternOf(keyword: string, { regex, wholeWords }: KeywordOptions): string {
	const source = regex ? keyword : keyword.replace(REGEX_SPECIALS, '\\$&');

	return wholeWords ? `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])` : source;
}

function compile(keyword: string, options: KeywordOptions): RegExp | undefined {
	try {
		return new RegExp(patternOf(keyword, options), options.caseSensitive ? 'u' : 'iu');
	} catch {
		return undefined;
	}
}

/**
 * @description Builds a test for message text from the user's keywords; blank keywords and invalid expressions are skipped.
 * @param options The keywords and how to match them.
 * @returns Whether a text contains any keyword.
 */
export function createKeywordMatcher(options: KeywordOptions): (text: string) => boolean {
	const patterns = options.keywords
		.map((keyword) => keyword.trim())
		.filter(Boolean)
		.map((keyword) => compile(keyword, options))
		.filter((pattern): pattern is RegExp => pattern !== undefined);

	return (text) => patterns.some((pattern) => pattern.test(text));
}

export default { createKeywordMatcher };
