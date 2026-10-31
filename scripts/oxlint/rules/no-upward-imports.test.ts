import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture, type JsonObject } from '../lint-fixture';

const layers: JsonObject[] = [
	{
		from: ['pkg/src/lib'],
		deny: ['~/ui', '@scope/app'],
		because: 'lib sits below ui',
	},
	{
		from: ['pkg/src/api'],
		deny: ['~/ui'],
		except: ['pkg/src/api/index.ts'],
		because: 'api sits below ui',
	},
];

test('flags runtime imports that climb a layer, in every import form', async () => {
	const findings = await lintFixture(
		'no-upward-imports',
		{
			'pkg/src/lib/static.ts':
				"import { Button } from '~/ui/button';\nexport const a = Button;",
			'pkg/src/lib/re-export.ts': "export { Button } from '~/ui/button';",
			'pkg/src/lib/dynamic.ts': "export const load = () => import('~/ui/button');",
			'pkg/src/lib/require.ts': "export const load = () => require('~/ui/button');",
			'pkg/src/lib/package.ts': "import { app } from '@scope/app';\nexport const a = app;",
			'pkg/src/lib/type-only.ts':
				"import type { Props } from '~/ui/button';\nexport type A = Props;",
			'pkg/src/lib/type-specifiers.ts':
				"import { type Props } from '~/ui/button';\nexport type A = Props;",
			'pkg/src/lib/prefix-only.ts': "import { a } from '~/uikit';\nexport const b = a;",
			'pkg/src/lib/down.ts': "import { a } from '~/lib/other';\nexport const b = a;",
			'pkg/src/api/index.ts': "export * from '~/ui/button';",
			'pkg/src/api/toasts.ts': "import { a } from '~/ui/button';\nexport const b = a;",
			'pkg/src/ui/button.ts': "import { a } from '~/lib/other';\nexport const b = a;",
		},
		{ layers },
	);

	expect(flaggedFiles(findings)).toEqual([
		'pkg/src/api/toasts.ts',
		'pkg/src/lib/dynamic.ts',
		'pkg/src/lib/package.ts',
		'pkg/src/lib/re-export.ts',
		'pkg/src/lib/require.ts',
		'pkg/src/lib/static.ts',
	]);
	expect(findings.find((finding) => finding.file === 'pkg/src/lib/static.ts')?.message).toContain(
		'lib sits below ui',
	);
});
