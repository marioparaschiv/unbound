import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

test('flags writes to process.env outside tests', async () => {
	const findings = await lintFixture('no-env-mutation', {
		'src/read.ts': 'export const mode = process.env.NODE_ENV;',
		'src/assign.ts': "process.env.NODE_ENV = 'production';",
		'src/default.ts': "process.env.NODE_ENV ??= 'development';",
		'src/computed.ts': "process.env['TOKEN'] = 'x';",
		'src/delete.ts': 'delete process.env.TOKEN;',
		'src/replace.ts': 'process.env = {};',
		'src/bracket.ts': "process['env'].TOKEN = 'x';",
		'src/object-assign.ts': "Object.assign(process.env, { TOKEN: 'x' });",
		'src/copy.ts': 'export const env = Object.assign({}, process.env);',
		'tests/setup.ts': "process.env.NODE_ENV = 'test';",
	});

	expect(flaggedFiles(findings)).toEqual([
		'src/assign.ts',
		'src/bracket.ts',
		'src/computed.ts',
		'src/default.ts',
		'src/delete.ts',
		'src/object-assign.ts',
		'src/replace.ts',
	]);
});
