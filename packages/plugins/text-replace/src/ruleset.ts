import { normalizeRules, type TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';

import { RULESET_VERSION } from '~/constants';

export type Ruleset = {
	stringRules: TextReplaceRule[];
	regexRules: TextReplaceRule[];
};

type ExportedRule = Pick<TextReplaceRule, 'find' | 'replace' | 'onlyIfIncludes'>;

type ParsedRuleset = {
	version?: number;
	stringRules?: ExportedRule[];
	regexRules?: ExportedRule[];
};

/**
 * @description Checks whether a rule has any field filled in.
 * @param rule The rule to check.
 * @returns `false` for a rule left completely blank.
 */
export function hasRuleContent(rule: TextReplaceRule): boolean {
	return Boolean(rule.find || rule.replace || rule.onlyIfIncludes);
}

function exportRules(rules: TextReplaceRule[]): ExportedRule[] {
	return rules
		.filter(hasRuleContent)
		.map(({ find, replace, onlyIfIncludes }) => ({ find, replace, onlyIfIncludes }));
}

/**
 * @description Encodes both rule lists as portable JSON, without the device-local rule ids.
 * @param ruleset The text and regex rules.
 * @returns Pretty-printed JSON.
 */
export function serializeRuleset({ stringRules, regexRules }: Ruleset): string {
	return JSON.stringify(
		{
			version: RULESET_VERSION,
			stringRules: exportRules(stringRules),
			regexRules: exportRules(regexRules),
		},
		null,
		2,
	);
}

/**
 * @description Decodes a ruleset exported by {@link serializeRuleset}, giving each rule a fresh id.
 * @param value The JSON text.
 * @returns The non-blank text and regex rules. Throws an `Error` with a user-facing message when the JSON is invalid or unsupported.
 */
export function parseRuleset(value: string): Ruleset {
	let parsed: ParsedRuleset | null;

	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error('This is not valid JSON.');
	}

	if (!parsed || typeof parsed !== 'object') {
		throw new Error('This is not a Text Replace ruleset.');
	}

	const { version, stringRules, regexRules } = parsed;

	if (version !== RULESET_VERSION || !Array.isArray(stringRules) || !Array.isArray(regexRules)) {
		throw new Error('This Text Replace ruleset is unsupported.');
	}

	return {
		stringRules: normalizeRules(stringRules).filter(hasRuleContent),
		regexRules: normalizeRules(regexRules).filter(hasRuleContent),
	};
}

export default { hasRuleContent, serializeRuleset, parseRuleset };
