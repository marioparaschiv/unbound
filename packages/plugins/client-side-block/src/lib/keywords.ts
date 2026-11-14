const REGEX_LINE = /^\/(.+)\/([a-z]*)$/;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternOf(line: string): RegExp | undefined {
	const regex = REGEX_LINE.exec(line);

	try {
		return regex
			? new RegExp(regex[1] ?? '', `${(regex[2] ?? '').replace('g', '')}i`)
			: new RegExp(escapeRegExp(line), 'i');
	} catch {
		return undefined;
	}
}

/**
 * @description Builds a matcher from the hidden keywords, one per line: plain text matches anywhere ignoring case, and a
 * line wrapped in slashes is a regular expression. Invalid expressions are skipped.
 * @param text The keywords as the settings store them.
 * @returns A test for message content, which matches nothing when no keywords are set.
 */
export function keywordMatcher(text: string): (content: string) => boolean {
	const patterns = text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map(patternOf)
		.filter((pattern): pattern is RegExp => pattern !== undefined);

	return (content) => patterns.some((pattern) => pattern.test(content));
}

export default keywordMatcher;
