import {
	createRule,
	normalizeRules,
	type TextReplaceRule,
} from '@unbound-plugins/shared/text-replace/rules';

import {
	readRules,
	type RuleKind,
	type Ruleset,
} from '@unbound-plugins/shared/text-replace/stored-rules';

import { settings } from '~/replace/modules';

/**
 * @description Rewrites both stored rule lists in their normalized shape, so every rule has an id.
 */
export function normalizeStoredRules(): void {
	for (const kind of ['stringRules', 'regexRules'] as const) {
		settings.set(kind, normalizeRules(settings.get(kind, [])));
	}
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
	saveRuleset,
	saveRule,
	deleteRule,
};
