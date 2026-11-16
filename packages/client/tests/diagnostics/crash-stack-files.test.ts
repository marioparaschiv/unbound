import { describe, expect, test } from 'bun:test';

import { crashStackFiles } from '~/diagnostics/crash-stack-files';

describe('crashStackFiles', () => {
	test('names a file after each crash that kept its stack', () => {
		const history = JSON.stringify([
			{ at: 1794803760000, crash: 'SIGTRAP in New Member Sprout', stack: 'Signal 5\n#0 0x1' },
			{ at: 1794803761000, crash: 'SIGSEGV' },
			{ at: 1794803762000, crash: 'SIGABRT', stack: '' },
		]);

		expect(crashStackFiles(history)).toEqual({
			'crashes/2026-11-16T04-36-00-000Z-SIGTRAP-in-New-Member-Sprout.txt': 'Signal 5\n#0 0x1',
		});
	});

	test('reads nothing from a history that is not a list of crashes', () => {
		expect(crashStackFiles('{"at":1')).toEqual({});
		expect(crashStackFiles('{}')).toEqual({});
		expect(crashStackFiles('[1, null, {"crash": 2}]')).toEqual({});
	});
});
