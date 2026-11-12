import { describe, expect, test } from 'bun:test';

import { hotBuildPath } from '../static';

describe('hot build paths', () => {
	test('serves the developer flavour from the default flavour the hot build keeps current', () => {
		expect(hotBuildPath('/unbound-dev.98.bundle')).toBe('/unbound.98.bundle');
		expect(hotBuildPath('/unbound-dev.js')).toBe('/unbound.js');
		expect(hotBuildPath('/unbound.98.bundle')).toBe('/unbound.98.bundle');
		expect(hotBuildPath('/devtools.98.bundle')).toBe('/devtools.98.bundle');
	});
});
