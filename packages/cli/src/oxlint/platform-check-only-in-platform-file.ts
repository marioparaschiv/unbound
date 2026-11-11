import type { Rule } from './rule';

import propertyName from './property-name.ts';

// `platform.ts` selects a handler; a file in `src/native/` or a `src/<folder>/ios/` or `src/<folder>/android/` folder may branch on the platform itself.
const PLATFORM_FILE =
	/(^|\/)platform\.[cm]?[jt]sx?$|(^|\/)src\/native\/[^/]+$|(^|\/)src\/[^/]+\/(ios|android)\/[^/]+$/;

const PLATFORM_KEY_BY_OBJECT = new Map([
	['Platform', 'OS'],
	['context', 'platform'],
]);

const platformCheckOnlyInPlatformFile: Rule = {
	meta: {
		type: 'suggestion',
		messages: {
			check: '`{{read}}` checks the platform outside `src/native/` and `platform.ts`. Branch in one small `src/native/` file, or split it into `src/<folder>/android/<file>` and `src/<folder>/ios/<file>`.',
		},
	},
	create(context) {
		if (PLATFORM_FILE.test(context.filename)) {
			return {};
		}

		return {
			MemberExpression(node) {
				if (node.object.type !== 'Identifier') return;

				const key = PLATFORM_KEY_BY_OBJECT.get(node.object.name);

				if (!key || propertyName(node) !== key) return;

				context.report({
					node,
					messageId: 'check',
					data: { read: `${node.object.name}.${key}` },
				});
			},
		};
	},
};

export default platformCheckOnlyInPlatformFile;
