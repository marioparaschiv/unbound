import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { consentCapabilities, consentKey, needsConsent } from './native-consent';

function manifest(overrides: Partial<AddonManifest> = {}): AddonManifest {
	return {
		id: 'example.plugin',
		name: 'Example',
		description: '',
		authors: [{ name: 'Author', id: '1' }],
		main: 'index.js',
		version: '1.0.0',
		...overrides,
	};
}

describe('native consent', () => {
	test('collects FFI capabilities from every platform', () => {
		const requested = manifest({
			capabilities: ['native.ffi.call', 'native.objc.invoke'],
			platformCapabilities: { android: ['native.ffi.symbols'], ios: ['native.ffi.call'] },
		});

		expect(consentCapabilities(requested)).toEqual(['native.ffi.call', 'native.ffi.symbols']);
		expect(consentKey(requested)).toBe('native.ffi.call,native.ffi.symbols');
	});

	test('does not ask for addons without FFI', () => {
		expect(needsConsent(manifest({ capabilities: ['native.objc.invoke'] }), {})).toBe(false);
		expect(needsConsent(manifest(), {})).toBe(false);
	});

	test('asks unsigned FFI addons until the user allows the same capabilities', () => {
		const requested = manifest({ capabilities: ['native.ffi.call'] });

		expect(needsConsent(requested, {})).toBe(true);
		expect(needsConsent(requested, { 'example.plugin': 'native.ffi.call' })).toBe(false);
		expect(
			needsConsent(manifest({ capabilities: ['native.ffi.call', 'native.ffi.symbols'] }), {
				'example.plugin': 'native.ffi.call',
			}),
		).toBe(true);
	});

	test('never asks for signed first-party addons', () => {
		expect(
			needsConsent(manifest({ capabilities: ['native.ffi.call'], trust: 'signed' }), {}),
		).toBe(false);
	});
});
