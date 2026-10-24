import { expect, test } from 'bun:test';

import { nextSurfaceName } from './surface-name';

test('takes index 0 when nothing is registered', () => {
	expect(nextSurfaceName('Surface', [])).toBe('Surface0');
});

test('skips names an earlier session registered', () => {
	expect(nextSurfaceName('Surface', ['Surface0', 'Surface1', 'Other2'])).toBe('Surface2');
});
