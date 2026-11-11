import type { Rule } from './rule';

import propertyName from './property-name.ts';

// `platform.ts` selects a handler; a file in `src/native/` may branch on the platform itself.
const PLATFORM_FILE = /(^|\/)platform\.[cm]?[jt]sx?$|(^|\/)src\/native\/[^/]+$/;

const PLATFORM_KEY_BY_OBJECT = new Map([
	['Platform', 'OS'],
	['context', 'platform'],
]);

const platformCheckOnlyInPlatformFile: Rule = {
	meta: {
		type: 'suggestion',
		messages: {
			check: '`{{read}}` checks the platform outside `src/native/` and `platform.ts`. Branch in one small `src/native/` file, or split it into `<kind>-android.ts` and `<kind>-ios.ts`.',
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
