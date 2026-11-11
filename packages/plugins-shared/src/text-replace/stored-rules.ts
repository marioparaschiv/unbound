import { normalizeRules, type TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import { getBucket, type Bucket } from '@unbound-app/api/storage';

/** Text Replace's manifest id, which also names the Bucket it stores its rules in. */
export const TEXT_REPLACE_ID = 'unbound.text-replace';

/** The two rule lists Text Replace stores: literal text rules and regex rules. */
export type RuleKind = 'stringRules' | 'regexRules';

/** Both of Text Replace's rule lists. */
export type Ruleset = Record<RuleKind, TextReplaceRule[]>;

type RulesReader = Pick<Bucket, 'get'>;

/**
 * @description Checks whether a rule has any field filled in.
 * @param rule The rule to check.
 * @returns `false` for a rule left completely blank.
 */
export function hasRuleContent(rule: TextReplaceRule): boolean {
	return Boolean(rule.find || rule.replace || rule.onlyIfIncludes);
}

/**
 * @description Reads one of Text Replace's stored rule lists, without blank rules; an empty list is stored as one blank rule.
 * @param kind Which list to read.
 * @param store The store to read through; pass the `storage.useBucket` result to re-render on changes.
 * @returns The rules.
 */
export function readRules(
	kind: RuleKind,
	store: RulesReader = getBucket(TEXT_REPLACE_ID),
): TextReplaceRule[] {
	return normalizeRules(store.get(kind, [])).filter(hasRuleContent);
}

/**
 * @description Reads the rules Text Replace applies to each sent message, so another plugin never reads its Bucket.
 * @param store The store to read through; pass the `storage.useBucket` result to re-render on changes.
 * @returns The text and regex rules, without blank rules.
 */
export function rules(store: RulesReader = getBucket(TEXT_REPLACE_ID)): Ruleset {
	return {
		stringRules: readRules('stringRules', store),
		regexRules: readRules('regexRules', store),
	};
}

export default { hasRuleContent, readRules, rules };
