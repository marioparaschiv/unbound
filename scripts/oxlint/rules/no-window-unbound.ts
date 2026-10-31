import type { Rule } from '../rule';

import propertyName from '../property-name.ts';

const GLOBAL_OBJECTS = new Set(['window', 'globalThis']);

const STRING_GLOBAL_PATH = /^(window|globalThis)\.unbound(\.|$)/;

const noWindowUnbound: Rule = {
	meta: {
		type: 'problem',
		messages: {
			global: '`window.unbound` is the unscoped API: patches, timers and listeners made through it outlive the plugin. Import from `@unbound-app/api` or use the scoped `unbound` global (ADR-0002).',
		},
	},
	create(context) {
		return {
			MemberExpression(node) {
				if (node.object.type !== 'Identifier' || !GLOBAL_OBJECTS.has(node.object.name))
					return;

				if (propertyName(node) === 'unbound') {
					context.report({ node, messageId: 'global' });
				}
			},
			Literal(node) {
				if (typeof node.value === 'string' && STRING_GLOBAL_PATH.test(node.value)) {
					context.report({ node, messageId: 'global' });
				}
			},
			TemplateLiteral(node) {
				const [head] = node.quasis;

				if (head && STRING_GLOBAL_PATH.test(head.value.cooked ?? head.value.raw)) {
					context.report({ node, messageId: 'global' });
				}
			},
		};
	},
};

export default noWindowUnbound;
