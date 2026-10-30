import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

test('flags relative imports that leave the nearest package', async () => {
	const findings = await lintFixture('no-import-outside-package', {
		'package.json': '{}',
		'apps/gen/package.json': '{}',
		'apps/gen/src/inside.ts': "import { a } from '../tests/helper';\nexport const b = a;",
		'apps/gen/src/nested/deep.ts':
			"import { a } from '../../package.json';\nexport const b = a;",
		'apps/gen/src/escape.ts':
			"import { config } from '../../../packages/api/sdk.config.ts';\nexport const b = config;",
		'apps/gen/src/re-export.ts': "export * from '../../other/src/index';",
		'apps/gen/src/sibling.ts': "import { a } from './inside';\nexport const b = a;",
	});

	expect(flaggedFiles(findings)).toEqual(['apps/gen/src/escape.ts', 'apps/gen/src/re-export.ts']);
	expect(findings[0]?.message).toContain('climbs out of this package');
});
