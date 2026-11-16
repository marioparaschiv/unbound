import { describe, expect, test } from 'bun:test';

import { devicePathScript } from '~/lib/device-files';

describe('devicePathScript', () => {
	test('starts a relative path in the folder that holds Unbound', () => {
		expect(devicePathScript('Unbound/Logs/unbound.log')).toBe(
			'path="$parent/Unbound/Logs/unbound.log"',
		);
		expect(devicePathScript('./Unbound')).toBe('path="$parent/Unbound"');
	});

	test('keeps an absolute path as it is', () => {
		expect(devicePathScript('/data/local/tmp/x')).toBe("path='/data/local/tmp/x'");
	});
});
