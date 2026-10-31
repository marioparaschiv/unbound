import { describe, expect, test } from 'bun:test';

import { unboundRelativePath } from './unbound-path';

describe('unboundRelativePath', () => {
	test('strips the Unbound folder', () => {
		expect(unboundRelativePath('Unbound/Themes/adrian.parity-theme')).toBe(
			'Themes/adrian.parity-theme',
		);
	});

	test('rejects paths outside the folder and the folder itself', () => {
		expect(unboundRelativePath('Other/file.txt')).toBeNull();
		expect(unboundRelativePath('Unbound/')).toBeNull();
		expect(unboundRelativePath('Unbound')).toBeNull();
	});
});
