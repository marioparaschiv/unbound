import { NATIVE_PLUGIN_PLATFORM_CAPABILITIES } from '@unbound-app/types/native';
import { describe, expect, test } from 'bun:test';

import { validateAddonCapabilities } from '~/manifest-capabilities';
import { addonManifestSchema } from '~/manifest';
import { safeParse } from '~/schema';

const androidCapabilities: readonly string[] = NATIVE_PLUGIN_PLATFORM_CAPABILITIES.android;
const [iosOnlyCapability = ''] = NATIVE_PLUGIN_PLATFORM_CAPABILITIES.ios.filter(
	(capability) => !androidCapabilities.includes(capability),
);

const published = {
	id: 'unbound.example-plugin',
	name: 'Example Plugin',
	description: 'An example.',
	authors: [{ name: 'Example', id: '1' }],
	main: 'index.js',
	version: '1.0.0',
};

describe('validateAddonCapabilities', () => {
	test('accepts every Capability the client declares, per platform', () => {
		expect(
			validateAddonCapabilities({
				platforms: Object.fromEntries(
					Object.entries(NATIVE_PLUGIN_PLATFORM_CAPABILITIES).map(
						([platform, capabilities]) => [platform, { capabilities }],
					),
				),
			}),
		).toEqual([]);
	});

	test('accepts a manifest without platforms', () => {
		expect(validateAddonCapabilities({})).toEqual([]);
	});

	test('rejects Capabilities the client does not declare', () => {
		expect(
			validateAddonCapabilities({
				platforms: { ios: { capabilities: ['native.objc.unknown'] } },
			}),
		).toEqual([
			{
				path: '/platforms/ios/capabilities/0',
				message: 'Must be a Capability, not native.objc.unknown.',
			},
		]);
	});

	test('rejects a flat Capability that only one platform can provide', () => {
		expect(validateAddonCapabilities({ capabilities: [iosOnlyCapability] })).toEqual([
			{ path: '/capabilities/0', message: `android cannot provide ${iosOnlyCapability}.` },
		]);
	});

	test('accepts a flat Capability that every supported platform provides', () => {
		expect(validateAddonCapabilities({ capabilities: ['native.runtime.events'] })).toEqual([]);
	});

	test('accepts a flat Capability restricted to the declared platforms', () => {
		expect(
			validateAddonCapabilities({
				platforms: { ios: {} },
				capabilities: ['native.objc.classes'],
			}),
		).toEqual([]);
	});

	test('accepts a platform-exclusive Capability declared under its platform', () => {
		expect(
			validateAddonCapabilities({
				platforms: {
					ios: { capabilities: ['native.objc.classes', 'native.fabric.mount'] },
				},
			}),
		).toEqual([]);
	});

	test('accepts Capabilities on both platforms', () => {
		expect(
			validateAddonCapabilities({
				platforms: {
					ios: { capabilities: ['native.objc.invoke'] },
					android: { capabilities: ['native.java.invoke'] },
				},
			}),
		).toEqual([]);
	});

	test('rejects a Capability its platform cannot provide', () => {
		expect(
			validateAddonCapabilities({
				platforms: { android: { capabilities: [iosOnlyCapability] } },
			}),
		).toEqual([
			{
				path: '/platforms/android/capabilities/0',
				message: `android cannot provide ${iosOnlyCapability}.`,
			},
		]);
	});

	test('rejects capabilities that are not arrays', () => {
		expect(
			validateAddonCapabilities({
				platforms: { ios: { capabilities: 'native.objc.classes' } },
			}),
		).toEqual([{ path: '/platforms/ios/capabilities', message: 'must be array' }]);
	});

	test('rejects platforms that are not supported targets', () => {
		expect(validateAddonCapabilities({ platforms: { web: {} } })).toEqual([
			{ path: '/platforms/web', message: 'Must be a supported platform: ios or android.' },
		]);
	});

	test('rejects empty platforms', () => {
		expect(validateAddonCapabilities({ platforms: {} })).toEqual([
			{ path: '/platforms', message: 'Must list a platform.' },
		]);
	});

	test('rejects the list form of platforms', () => {
		expect(validateAddonCapabilities({ platforms: ['ios'] })).toEqual([
			{ path: '/platforms', message: 'must be object' },
		]);
	});

	test('rejects a platform entry that is not an object', () => {
		expect(validateAddonCapabilities({ platforms: { ios: [] } })).toEqual([
			{ path: '/platforms/ios', message: 'must be object' },
		]);
	});
});

describe('addonManifestSchema', () => {
	test('applies the same Capability rules to a published manifest', () => {
		const result = safeParse(addonManifestSchema, {
			...published,
			platforms: { android: { capabilities: [iosOnlyCapability] } },
		});

		expect(result.success ? [] : result.error.issues).toEqual([
			{
				path: '/platforms/android/capabilities/0',
				message: `android cannot provide ${iosOnlyCapability}.`,
			},
		]);
	});

	test('accepts a manifest whose platforms provide its Capabilities', () => {
		expect(
			safeParse(addonManifestSchema, {
				...published,
				platforms: { ios: { capabilities: [iosOnlyCapability] } },
			}).success,
		).toBe(true);
	});
});
