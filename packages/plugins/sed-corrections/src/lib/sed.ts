export type Substitution = { pattern: string; replacement: string; flags: string };

const SED = /^s\/((?:\\.|[^\\/])*)\/((?:\\.|[^\\/])*)\/?([gi]*)$/;

/**
 * @description Reads a sed substitution, `s/find/replace/` with optional `g` and `i` flags; `\/` writes a slash.
 * @param text The message being sent.
 * @returns The substitution, or `undefined` when the message is not one.
 */
export function parseSubstitution(text: string): Substitution | undefined {
	const match = SED.exec(text.trim());

	if (!match || !match[1]) return undefined;

	return {
		pattern: match[1].replaceAll('\\/', '/'),
		replacement: match[2]!.replaceAll('\\/', '/'),
		flags: match[3] ?? '',
	};
}

function expression(pattern: string, flags: string): RegExp {
	try {
		return new RegExp(pattern, flags);
	} catch {
		return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
	}
}

function jsReplacement(replacement: string): string {
	return replacement
		.replaceAll('$', '$$$$')
		.replace(/\\(\d)/g, '$$$1')
		.replace(/(^|[^\\])&/g, '$1$$&')
		.replaceAll('\\&', '&');
}

/**
 * @description Applies a substitution like sed: a regular expression, or the literal text when it isn't a valid one;
 * `&` and `\1` in the replacement insert the match and its groups.
 * @param content The message to correct.
 * @param substitution The substitution.
 * @returns The corrected text, or `undefined` when nothing matched.
 */
export function applySubstitution(
	content: string,
	{ pattern, replacement, flags }: Substitution,
): string | undefined {
	const find = expression(pattern, flags);

	if (!find.test(content)) return undefined;

	find.lastIndex = 0;

	return content.replace(find, jsReplacement(replacement));
}
