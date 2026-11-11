import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '~/lint-fixture';

test('flags platform checks outside platform.ts, src/native/ and its platform folders', async () => {
	const findings = await lintFixture('platform-check-only-in-platform-file', {
		'src/platform.ts': "export default Platform.OS === 'ios' ? ios : android;",
		'src/ios/platform.tsx': "export const ios = context.platform === 'ios';",
		'src/native/views.ts': "export const ios = Platform.OS === 'ios';",
		'src/native/ios/views.ts': "export const ios = Platform.OS === 'ios';",
		'src/native/android/views.ts': "export const android = Platform.OS === 'android';",
		'src/native/ios/deeper/views.ts': "export const ios = Platform.OS === 'ios';",
		'src/lib/ios/colors.ts': "export const ios = Platform.OS === 'ios';",
		'src/lib/native.ts': "export const ios = Platform.OS === 'ios';",
		'src/select.ts': 'export const gap = Platform.select({ ios: 4, android: 0 });',
		'src/other-context.ts': 'export const id = context.id;',
		'src/platform-utils.ts': "export const ios = Platform.OS === 'ios';",
		'src/index.ts':
			"export function start(context) { if (context.platform === 'android') return; }",
		'src/style.ts': "export const gap = Platform['OS'] === 'android' ? 4 : 0;",
	});

	expect(flaggedFiles(findings)).toEqual([
		'src/index.ts',
		'src/lib/ios/colors.ts',
		'src/lib/native.ts',
		'src/native/ios/deeper/views.ts',
		'src/platform-utils.ts',
		'src/style.ts',
	]);
});
