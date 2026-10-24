export type TextReplaceRule = {
	find: string;
	replace: string;
	onlyIfIncludes: string;
	id: string;
};

type StoredRule = {
	find?: unknown;
	replace?: unknown;
	onlyIfIncludes?: unknown;
	id?: unknown;
} | null;

let created = 0;

/**
 * @description Creates an empty rule with a unique id.
 * @returns A rule with blank `find`, `replace` and `onlyIfIncludes`.
 */
export function createRule(): TextReplaceRule {
	created++;

	return {
		find: '',
		replace: '',
		onlyIfIncludes: '',
		id: `${Date.now()}-${created}-${Math.random().toString(36).slice(2)}`,
	};
}

function isText(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * @description Turns a stored rule list into well-formed rules, giving each one an id.
 * @param value The list read from storage or an imported ruleset.
 * @returns The rules, or a single empty rule when the list is missing or empty.
 */
export function normalizeRules(
	// UNKNOWN: storage and imported rulesets hold whatever shape users or older versions wrote.
	value: unknown,
): TextReplaceRule[] {
	if (!Array.isArray(value) || !value.length) {
		return [createRule()];
	}

	return value.map((rule: StoredRule) => ({
		find: isText(rule?.find) ? rule.find : '',
		replace: isText(rule?.replace) ? rule.replace : '',
		onlyIfIncludes: isText(rule?.onlyIfIncludes) ? rule.onlyIfIncludes : '',
		id: isText(rule?.id) && rule.id ? rule.id : createRule().id,
	}));
}

/**
 * @description Parses a regex rule's pattern, written either bare or as `/pattern/flags`.
 * @param value The pattern. Without flags it defaults to `g`; repeated flags are dropped.
 * @returns The compiled expression. Throws when the pattern is invalid.
 */
export function stringToRegex(value: string): RegExp {
	const match = value.match(/^(\/)?(.+?)(?:\/([gimsuyv]*))?$/);
	const flags = match?.[3] ? [...new Set(match[3])].join('') : 'g';

	return new RegExp(match ? match[2] : value, flags);
}

function applies(rule: TextReplaceRule, content: string): boolean {
	return Boolean(rule.find) && (!rule.onlyIfIncludes || content.includes(rule.onlyIfIncludes));
}

function withNewlines(value: string): string {
	return value.replaceAll('\\n', '\n');
}

/**
 * @description Rewrites a message with the text rules first, then the regex rules.
 * @param content The message content.
 * @param stringRules Literal rules, replacing every occurrence.
 * @param regexRules Regex rules; an invalid pattern is skipped.
 * @returns The rewritten, trimmed content.
 */
export function applyRules(
	content: string,
	stringRules: TextReplaceRule[],
	regexRules: TextReplaceRule[],
): string {
	if (!content) {
		return content;
	}

	for (const rule of stringRules) {
		if (!applies(rule, content)) {
			continue;
		}

		content = ` ${content} `
			.replaceAll(rule.find, withNewlines(rule.replace))
			.replace(/^\s|\s$/g, '');
	}

	for (const rule of regexRules) {
		if (!applies(rule, content)) {
			continue;
		}

		try {
			content = content.replace(stringToRegex(rule.find), withNewlines(rule.replace));
		} catch {
			// An invalid pattern leaves the message as it is.
		}
	}

	return content.trim();
}

export default { createRule, normalizeRules, stringToRegex, applyRules };
