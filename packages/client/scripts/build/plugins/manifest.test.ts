import { describe, expect, test } from 'bun:test';

import { describeBytecodeMismatch } from './manifest';
import { bytecodeVersions } from '../hermes.json';

describe('describeBytecodeMismatch', () => {
	test('accepts the declared versions in any order', () => {
		expect(describeBytecodeMismatch([98, 96, 94], [94, 98, 96])).toBeNull();
	});

	test('names versions the build is missing or did not declare', () => {
		expect(describeBytecodeMismatch([98, 96, 94], [100, 98, 96])).toBe(
			'hermes.json declares bytecode 98, 96, 94, but the build is missing 94 and also produced 100. Update hermes.json so the compatibility scan checks what ships.',
		);
		expect(describeBytecodeMismatch([98, 96], [98])).toContain('is missing 96.');
	});

	test('declares at least one version', () => {
		expect(bytecodeVersions.length).toBeGreaterThan(0);
	});
});
