import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	currentClientVersion,
	isPreResetVersion,
	minimumClientVersion,
} from '~/client-version-reset';

describe('client version reset', () => {
	test('reads 2.x and 3.x as pre-reset', () => {
		expect(isPreResetVersion('3.12.1')).toBe(true);
		expect(isPreResetVersion('2.0.0')).toBe(true);
		expect(isPreResetVersion('1.4.0')).toBe(false);
		expect(isPreResetVersion('4.0.0')).toBe(false);
	});

	test('treats a pre-reset client as 1.0.0', () => {
		expect(currentClientVersion('3.12.1')).toBe('1.0.0');
		expect(currentClientVersion('1.2.0')).toBe('1.2.0');
	});

	test('drops a pre-reset addon minimum', () => {
		expect(minimumClientVersion('3.0.0')).toBeUndefined();
		expect(minimumClientVersion('1.1.0')).toBe('1.1.0');
		expect(minimumClientVersion(undefined)).toBeUndefined();
	});

	// A 2.x client on the new numbering would read as pre-reset, so the rule must go before then.
	test('the client is still below 2.0.0 on the new numbering, or not yet reset', () => {
		const path = join(import.meta.dir, '../../client/package.json');
		const { version } = JSON.parse(readFileSync(path, 'utf8')) as { version: string };
		const [major = 0, minor = 0] = version.split('.').map(Number);

		expect(major < 2 || (major === 3 && minor === 12)).toBe(true);
	});
});
