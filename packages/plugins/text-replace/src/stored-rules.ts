import {
	createRule,
	normalizeRules,
	type TextReplaceRule,
} from '@unbound-plugins/shared/text-replace/rules';

import { hasRuleContent, type Ruleset } from '~/ruleset';
import type { RuleKind } from '~/constants';
import { settings } from '~/modules';

type SettingsReader = Pick<typeof settings, 'get'>;

/**
 * @description Rewrites both stored rule lists in their normalized shape, so every rule has an id.
 */
export function normalizeStoredRules(): void {
	for (const kind of ['stringRules', 'regexRules'] as const) {
		settings.set(kind, normalizeRules(settings.get(kind, [])));
	}
}

/**
 * @description Reads one stored rule list, without blank rules.
 * @param kind Which list to read.
 * @param store The store to read through; pass the `useSettingsStore` result to re-render on changes.
 * @returns The rules.
 */
export function readRules(kind: RuleKind, store: SettingsReader = settings): TextReplaceRule[] {
	return normalizeRules(store.get(kind, [])).filter(hasRuleContent);
}

/**
 * @description Reads both stored rule lists, without blank rules.
 * @param store The store to read through; pass the `useSettingsStore` result to re-render on changes.
 * @returns The text and regex rules.
 */
export function readRuleset(store: SettingsReader = settings): Ruleset {
	return {
		stringRules: readRules('stringRules', store),
		regexRules: readRules('regexRules', store),
	};
}

// An empty list is stored as one blank rule.
function saveRules(kind: RuleKind, rules: TextReplaceRule[]): void {
	settings.set(kind, rules.length ? rules : [createRule()]);
}

/**
 * @description Replaces both stored rule lists.
 * @param ruleset The text and regex rules.
 */
export function saveRuleset({ stringRules, regexRules }: Ruleset): void {
	saveRules('stringRules', stringRules);
	saveRules('regexRules', regexRules);
}

/**
 * @description Stores a rule: a new rule is appended, an edited one replaces the rule with its id.
 * @param kind Which list the rule belongs to.
 * @param rule The rule to store.
 * @param isNew Whether the rule was just created.
 */
export function saveRule(kind: RuleKind, rule: TextReplaceRule, isNew: boolean): void {
	const rules = readRules(kind);

	saveRules(
		kind,
		isNew
			? [...rules, rule]
			: rules.map((current) => (current.id === rule.id ? rule : current)),
	);
}

/**
 * @description Removes a stored rule.
 * @param kind Which list the rule belongs to.
 * @param id The rule's id.
 */
export function deleteRule(kind: RuleKind, id: string): void {
	saveRules(
		kind,
		readRules(kind).filter((rule) => rule.id !== id),
	);
}

export default {
	normalizeStoredRules,
	readRules,
	readRuleset,
	saveRuleset,
	saveRule,
	deleteRule,
};
