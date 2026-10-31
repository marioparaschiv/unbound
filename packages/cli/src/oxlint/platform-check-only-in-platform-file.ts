import type { Rule } from './rule';

import propertyName from './property-name.ts';

const PLATFORM_FILE = /(^|\/)platform\.[cm]?[jt]sx?$/;

const PLATFORM_KEY_BY_OBJECT = new Map([
	['Platform', 'OS'],
	['context', 'platform'],
]);

const platformCheckOnlyInPlatformFile: Rule = {
	meta: {
		type: 'suggestion',
		messages: {
			check: '`{{read}}` checks the platform outside `platform.ts`. Select the platform handler once in `platform.ts` with `definePlatform` and keep platform code in `ios/` and `android/`.',
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
