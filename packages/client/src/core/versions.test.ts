import { describe, expect, test } from 'bun:test';

import { compareVersions } from './versions';

describe('compareVersions', () => {
	test('follows semver precedence', () => {
		const ordered = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-beta', '1.0.0', '1.2.0', '1.10.0'];

		for (let i = 1; i < ordered.length; i++) {
			expect(compareVersions(ordered[i - 1] ?? '', ordered[i] ?? '')).toBeLessThan(0);
			expect(compareVersions(ordered[i] ?? '', ordered[i - 1] ?? '')).toBeGreaterThan(0);
		}

		expect(compareVersions('1.0.0+build', '1.0.0')).toBe(0);
	});
});
