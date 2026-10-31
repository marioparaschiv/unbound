import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describeBytecodeMismatch, parseNativeBridgeVersion } from './manifest';
import { bytecodeVersions } from '../hermes.json';

describe('describeBytecodeMismatch', () => {
	test('accepts the declared versions in any order', () => {
		expect(describeBytecodeMismatch([98, 96, 94], [94, 98, 96])).toBeNull();
	});

	test('names versions the build is missing or did not declare', () => {
		const mismatch = describeBytecodeMismatch([98, 96, 94], [100, 98, 96]);

		expect(mismatch).toContain('missing 94');
		expect(mismatch).toContain('produced 100');
		expect(describeBytecodeMismatch([98, 96], [98])).toContain('is missing 96.');
	});

	test('declares at least one version', () => {
		expect(bytecodeVersions.length).toBeGreaterThan(0);
	});
});

describe('parseNativeBridgeVersion', () => {
	test('reads the versions the loader declares', () => {
		const header = readFileSync(
			resolve(__dirname, '../../../../loader/core/include/NativePluginVersion.h'),
			'utf8',
		);

		expect(parseNativeBridgeVersion(header)).toEqual({
			api: expect.stringMatching(/^\d+\.\d+\.\d+$/),
			abi: expect.stringMatching(/^\d+\.\d+\.\d+$/),
		});
	});

	test('reads both constants', () => {
		expect(
			parseNativeBridgeVersion(
				'inline constexpr char kNativePluginApiVersion[] = "1.4.0";\ninline constexpr char kNativePluginAbiVersion[] = "2.0.1";',
			),
		).toEqual({ api: '1.4.0', abi: '2.0.1' });
	});

	test('fails when a constant is missing', () => {
		expect(() => parseNativeBridgeVersion('kNativePluginApiVersion[] = "1.0.0";')).toThrow(
			'kNativePluginAbiVersion',
		);
	});
});
