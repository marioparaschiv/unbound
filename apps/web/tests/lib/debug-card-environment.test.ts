import { expect, test } from 'bun:test';

import { environmentRows } from '~/lib/debug-card/environment-rows';

test('shows the binary build without the dylib count, injections or UUID', () => {
	const rows = environmentRows({
		binary: 'decrypted · min 16.0 · SDK 27.1 · 108 dylibs · 1 injected · UUID 2F737236',
	});

	expect(rows).toEqual([
		['binary', [expect.objectContaining({ text: 'decrypted · min 16.0 · SDK 27.1' })]],
	]);
});
