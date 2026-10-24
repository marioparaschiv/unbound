// Messages sent to the Vencord Text Replace rules channel are shared rules, so they are never rewritten.
export const RULES_CHANNEL_ID = '1102784112584040479';

export const RULESET_VERSION = 1;

export const RuleKinds = {
	stringRules: {
		noun: 'text',
		title: 'Text rules',
		description: 'Simple text replacements that work as you type.',
		tag: '',
		findLabel: 'Find text',
		findPlaceholder: 'What should change?',
		help: 'This replaces every matching piece of text before the message is sent.',
	},
	regexRules: {
		noun: 'regex',
		title: 'Regex rules',
		description: 'Powerful pattern replacements for advanced rules.',
		tag: 'Regex · ',
		findLabel: 'Pattern',
		findPlaceholder: '/pattern/gi',
		help: 'Use a JavaScript pattern such as /hello/gi. Invalid patterns are skipped when sending.',
	},
} as const;

export type RuleKind = keyof typeof RuleKinds;
