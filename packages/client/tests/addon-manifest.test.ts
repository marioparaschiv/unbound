import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	NativePluginCapabilityError,
	NativePluginPlatformError,
	NativePluginUnsupportedPlatformError,
} from '~/api/native-errors';
import { parseAddonManifest, resolveManifestCapabilities } from '~/lib/addon-manifest';

const base: AddonManifest = {
	id: 'unbound.example',
	name: 'Example',
	description: 'An example.',
	authors: [{ name: 'Someone', id: '1' }],
	version: '1.0.0',
	main: 'index.js',
};

describe('parseAddonManifest', () => {
	test('returns a well-formed manifest unchanged', () => {
		expect(parseAddonManifest(base)).toBe(base);
	});

	test('names the field that is missing or malformed', () => {
		expect(() => parseAddonManifest('manifest')).toThrow('Manifest must be an object');
		expect(() => parseAddonManifest({ ...base, version: undefined })).toThrow(
			'Manifest missing required field: version',
		);
		expect(() => parseAddonManifest({ ...base, authors: [] })).toThrow('Manifest authors');
		expect(() => parseAddonManifest({ ...base, platforms: ['web'] })).toThrow(
			'unsupported platform: web',
		);
		expect(() => parseAddonManifest({ ...base, platformCapabilities: [] })).toThrow(
			'Manifest platformCapabilities must be an object',
		);
		expect(() => parseAddonManifest({ ...base, unbound: { min: 1 } })).toThrow('unbound.min');
	});

	test('refuses a platform capability Unbound does not know', () => {
		expect(() =>
			parseAddonManifest({ ...base, platformCapabilities: { ios: ['native.unknown'] } }),
		).toThrow(NativePluginCapabilityError);
	});
});

describe('resolveManifestCapabilities', () => {
	const manifest: AddonManifest = {
		...base,
		capabilities: ['native.runtime.events', 'native.objc.classes'],
		platformCapabilities: {
			ios: ['native.objc.classes', 'native.objc.invoke'],
			android: ['native.java.classes'],
		},
	};

	test('adds the current platform capabilities without duplicates', () => {
		expect(resolveManifestCapabilities(manifest, 'ios')).toEqual([
			'native.runtime.events',
			'native.objc.classes',
			'native.objc.invoke',
		]);
		expect(resolveManifestCapabilities(manifest, 'android')).toEqual([
			'native.runtime.events',
			'native.objc.classes',
			'native.java.classes',
		]);
	});

	test('refuses a host the manifest does not support', () => {
		expect(() =>
			resolveManifestCapabilities({ ...base, platforms: ['ios'] }, 'android'),
		).toThrow(NativePluginUnsupportedPlatformError);
		expect(() =>
			resolveManifestCapabilities({ ...base, platforms: ['ios'] }, undefined),
		).toThrow(NativePluginUnsupportedPlatformError);
	});

	test('needs a known host only when capabilities depend on the platform', () => {
		expect(() => resolveManifestCapabilities(manifest, 'web')).toThrow(
			NativePluginPlatformError,
		);
		expect(resolveManifestCapabilities({ ...base, capabilities: [] }, 'web')).toEqual([]);
	});
});
