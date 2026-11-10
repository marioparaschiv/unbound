import { describe, expect, test } from 'bun:test';

import { buildEnv, readBuildEnv } from '~/rollup/build-env';

describe('build env', () => {
	test('the preset reads back what ubd writes', () => {
		for (const settings of [
			{ hot: false, verbose: false, reportFile: undefined },
			{ hot: true, verbose: true, reportFile: '/tmp/report.json' },
		]) {
			expect(readBuildEnv(buildEnv(settings))).toEqual(settings);
		}
	});

	test('writes nothing for a plain build', () => {
		expect(buildEnv({ hot: false, verbose: false })).toEqual({});
	});
});
