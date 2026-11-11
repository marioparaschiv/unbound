import { describe, expect, test } from 'bun:test';

import { resolveOutDir } from '~/config';

describe('resolveOutDir', () => {
	test('resolves a nested directory inside the root', () => {
		expect(resolveOutDir('/repo', 'packages/api/src')).toBe('/repo/packages/api/src');
	});

	test('rejects the root itself', () => {
		expect(() => resolveOutDir('/repo', '.')).toThrow('inside the repository');
	});

	test('rejects paths escaping the root', () => {
		expect(() => resolveOutDir('/repo', '..')).toThrow('inside the repository');
		expect(() => resolveOutDir('/repo', '/elsewhere')).toThrow('inside the repository');
	});

	test('rejects sibling directories sharing the root as a prefix', () => {
		expect(() => resolveOutDir('/repo', '../repo-backup')).toThrow('inside the repository');
	});
});
