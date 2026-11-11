import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	parseAddonManifest,
	resolveManifestCapabilities,
	resolveManifestPlatforms,
} from '~/addons/manifest';
import { NativeBridgeCapabilityError, NativeBridgeUnsupportedPlatformError } from '~/native/errors';

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
		expect(() => parseAddonManifest({ ...base, platforms: ['ios'] })).toThrow(
			'Manifest platforms must be an object',
		);
		expect(() => parseAddonManifest({ ...base, unbound: { min: 1 } })).toThrow('unbound.min');
	});

	test('reads the API floor of an addon built before the native bridge rename', () => {
		expect(
			parseAddonManifest({ ...base, minNativePluginApi: '1.2.0' }).minNativeBridgeApi,
		).toBe('1.2.0');
		expect(
			parseAddonManifest({
				...base,
				minNativeBridgeApi: '1.1.0',
				minNativePluginApi: '1.2.0',
			}).minNativeBridgeApi,
		).toBe('1.1.0');
	});

	test('refuses a platform capability Unbound does not know', () => {
		expect(() =>
			parseAddonManifest({
				...base,
				platforms: { ios: { capabilities: ['native.unknown'] } },
			}),
		).toThrow(NativeBridgeCapabilityError);
	});

	test('accepts the platforms object and checks its shape', () => {
		const manifest: AddonManifest = {
			...base,
			platforms: { ios: { capabilities: ['native.objc.classes'] } },
		};

		expect(parseAddonManifest(manifest)).toBe(manifest);
		expect(() => parseAddonManifest({ ...base, platforms: {} })).toThrow('must not be empty');
		expect(() => parseAddonManifest({ ...base, platforms: { web: {} } })).toThrow(
			'unsupported platform: web',
		);
		expect(() => parseAddonManifest({ ...base, platforms: { ios: true } })).toThrow(
			'Manifest platforms.ios must be an object',
		);
	});
});

describe('resolveManifestPlatforms', () => {
	test('reads the platforms object', () => {
		expect(
			resolveManifestPlatforms({
				...base,
				capabilities: ['native.runtime.events'],
				platforms: {
					ios: { capabilities: ['native.objc.classes', 'native.objc.classes'] },
				},
			}),
		).toEqual({
			platforms: ['ios'],
			capabilities: { ios: ['native.runtime.events', 'native.objc.classes'] },
		});
	});

	test('runs flat capabilities on every platform', () => {
		expect(
			resolveManifestPlatforms({ ...base, capabilities: ['native.runtime.events'] }),
		).toEqual({
			platforms: ['ios', 'android'],
			capabilities: {
				ios: ['native.runtime.events'],
				android: ['native.runtime.events'],
			},
		});
	});

	test('runs on every platform without capabilities when platforms is absent', () => {
		expect(resolveManifestPlatforms(base)).toEqual({
			platforms: ['ios', 'android'],
			capabilities: { ios: [], android: [] },
		});
	});
});

describe('resolveManifestCapabilities', () => {
	const manifest: AddonManifest = {
		...base,
		capabilities: ['native.runtime.events', 'native.objc.classes'],
		platforms: {
			ios: { capabilities: ['native.objc.classes', 'native.objc.invoke'] },
			android: { capabilities: ['native.java.classes'] },
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
			resolveManifestCapabilities({ ...base, platforms: { ios: {} } }, 'android'),
		).toThrow(NativeBridgeUnsupportedPlatformError);
		expect(() => resolveManifestCapabilities(manifest, 'web')).toThrow(
			NativeBridgeUnsupportedPlatformError,
		);
	});

	test('needs no known host when the manifest lists no platforms', () => {
		expect(
			resolveManifestCapabilities(
				{ ...base, capabilities: ['native.runtime.events'] },
				'web',
			),
		).toEqual(['native.runtime.events']);
	});
});
