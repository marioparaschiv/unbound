import { messages } from '@unbound-app/i18n';

import type { RuleKind } from '@unbound-plugins/shared/text-replace/stored-rules';

/**
 * @description Reads the texts a kind of rule is shown with, in the user's language.
 * @param kind Which list of rules.
 * @returns The titles, labels and help of that kind. `tag` is blank for text rules.
 */
export function ruleKindMessages(kind: RuleKind) {
	return kind === 'stringRules'
		? {
				title: messages.TEXT_RULES_TITLE,
				description: messages.TEXT_RULES_DESCRIPTION,
				tag: '',
				findLabel: messages.TEXT_FIND_LABEL,
				findPlaceholder: messages.TEXT_FIND_PLACEHOLDER,
				help: messages.TEXT_HELP,
				addRule: messages.ADD_TEXT_RULE,
				newRule: messages.NEW_TEXT_RULE,
			}
		: {
				title: messages.REGEX_RULES_TITLE,
				description: messages.REGEX_RULES_DESCRIPTION,
				tag: messages.REGEX_RULE_TAG,
				findLabel: messages.REGEX_FIND_LABEL,
				findPlaceholder: messages.REGEX_FIND_PLACEHOLDER,
				help: messages.REGEX_HELP,
				addRule: messages.ADD_REGEX_RULE,
				newRule: messages.NEW_REGEX_RULE,
			};
}
