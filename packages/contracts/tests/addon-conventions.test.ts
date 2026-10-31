import { NATIVE_PLUGIN_PLATFORM_CAPABILITIES } from '@unbound-app/types/native';
import { describe, expect, test } from 'bun:test';

import {
	ADDON_DESCRIPTION_MAX_LENGTH,
	ADDON_FOLDER_MAX_LENGTH,
	ADDON_NAME_MAX_LENGTH,
	validateAddonCapabilities,
	validateAddonNaming,
} from '../src/addon-conventions';

const manifest = {
	id: 'unbound.example-plugin',
	name: 'Example Plugin',
	description: 'A concise example plugin description.',
};

const androidCapabilities: readonly string[] = NATIVE_PLUGIN_PLATFORM_CAPABILITIES.android;
const [iosOnlyCapability = ''] = NATIVE_PLUGIN_PLATFORM_CAPABILITIES.ios.filter(
	(capability) => !androidCapabilities.includes(capability),
);

describe('validateAddonNaming', () => {
	test('accepts a conventional folder, id, name and description', () => {
		expect(validateAddonNaming(manifest, 'example-plugin')).toEqual([]);
	});

	test('rejects folders that are not lowercase kebab-case', () => {
		expect(validateAddonNaming(manifest, 'Example_Plugin').join('\n')).toMatch(/folder/);
	});

	test('enforces the folder length limit', () => {
		const folder = `a${'b'.repeat(ADDON_FOLDER_MAX_LENGTH)}`;

		expect(validateAddonNaming(manifest, folder).join('\n')).toMatch(/folder/);
	});

	test('requires ids to match their folder suffix', () => {
		expect(validateAddonNaming(manifest, 'other-plugin').join('\n')).toContain('other-plugin');
	});

	test('skips the folder rules without a folder', () => {
		expect(validateAddonNaming(manifest)).toEqual([]);
	});

	test('rejects an id without a lowercase namespace', () => {
		expect(validateAddonNaming({ ...manifest, id: 'ExamplePlugin' })).toEqual([
			'id must use a lowercase namespace and kebab-case suffix',
		]);
	});

	test('enforces display name and description limits', () => {
		const errors = validateAddonNaming({
			...manifest,
			name: 'x'.repeat(ADDON_NAME_MAX_LENGTH + 1),
			description: 'x'.repeat(ADDON_DESCRIPTION_MAX_LENGTH + 1),
		}).join('\n');

		expect(errors).toMatch(/name/);
		expect(errors).toMatch(/description/);
	});

	test('rejects control characters and surrounding whitespace', () => {
		expect(validateAddonNaming({ ...manifest, description: ' Tab\there ' })).toEqual([
			'description must not have leading or trailing whitespace',
			'description must not contain control characters',
		]);
	});

	test('requires display names to separate words', () => {
		expect(validateAddonNaming({ ...manifest, name: 'TextReplace' }).join('\n')).toMatch(
			/name/,
		);
	});

	test('allows established brand names with uppercase acronyms', () => {
		expect(validateAddonNaming({ ...manifest, name: 'PronounDB' })).toEqual([]);
		expect(validateAddonNaming({ ...manifest, name: 'ReviewDB' })).toEqual([]);
	});
});

describe('validateAddonCapabilities', () => {
	test('accepts every Capability the client declares, per platform', () => {
		expect(
			validateAddonCapabilities({
				platforms: Object.keys(NATIVE_PLUGIN_PLATFORM_CAPABILITIES),
				platformCapabilities: NATIVE_PLUGIN_PLATFORM_CAPABILITIES,
			}),
		).toEqual([]);
	});

	test('rejects Capabilities the client does not declare', () => {
		const errors = validateAddonCapabilities({ capabilities: ['native.objc.unknown'] });

		expect(errors.join('\n')).toContain('native.objc.unknown');
	});

	test('rejects a flat Capability that only one platform can provide', () => {
		const errors = validateAddonCapabilities({ capabilities: [iosOnlyCapability] });

		expect(errors.find((error) => error.includes(iosOnlyCapability))).toMatch(/android/);
	});

	test('accepts a flat Capability that every supported platform provides', () => {
		expect(validateAddonCapabilities({ capabilities: ['native.runtime.events'] })).toEqual([]);
	});

	test('accepts a platform-exclusive Capability declared under its platform', () => {
		expect(
			validateAddonCapabilities({
				platforms: ['ios'],
				platformCapabilities: { ios: ['native.objc.classes', 'native.fabric.mount'] },
			}),
		).toEqual([]);
	});

	test('accepts a flat Capability restricted to the declared platforms', () => {
		expect(
			validateAddonCapabilities({
				platforms: ['ios'],
				capabilities: ['native.objc.classes'],
			}),
		).toEqual([]);
	});

	test('accepts the object form of platforms', () => {
		expect(
			validateAddonCapabilities({
				platforms: {
					ios: { capabilities: ['native.objc.invoke'] },
					android: { capabilities: ['native.java.invoke'] },
				},
			}),
		).toEqual([]);
	});

	test('rejects an object-form Capability its platform cannot provide', () => {
		expect(
			validateAddonCapabilities({
				platforms: { android: { capabilities: [iosOnlyCapability] } },
			}),
		).toEqual([`platforms.android cannot provide ${iosOnlyCapability}`]);
	});

	test('rejects platformCapabilities for a platform missing from the object form', () => {
		const errors = validateAddonCapabilities({
			platforms: { ios: {} },
			platformCapabilities: { android: ['native.java.classes'] },
		});

		expect(errors).toEqual([
			'platformCapabilities declares android, which is not in platforms',
		]);
	});

	test('rejects platforms that are not supported targets', () => {
		expect(validateAddonCapabilities({ platforms: ['web'] }).join('\n')).toContain('web');
	});

	test('rejects an empty platforms list', () => {
		expect(validateAddonCapabilities({ platforms: [] }).join('\n')).toMatch(/platforms.*empty/);
	});

	test('rejects duplicate platforms', () => {
		expect(validateAddonCapabilities({ platforms: ['ios', 'ios'] }).join('\n')).toMatch(
			/platforms.*ios/,
		);
	});

	test('rejects platformCapabilities for a platform the addon does not support', () => {
		const errors = validateAddonCapabilities({
			platforms: ['ios'],
			platformCapabilities: { android: ['native.java.classes'] },
		});

		expect(errors.join('\n')).toMatch(/platformCapabilities.*android/);
	});

	test('rejects a platformCapabilities entry the platform cannot provide', () => {
		const errors = validateAddonCapabilities({
			platformCapabilities: { android: [iosOnlyCapability] },
		});

		expect(errors.find((error) => error.includes(iosOnlyCapability))).toMatch(
			/platformCapabilities\.android/,
		);
	});

	test('rejects platformCapabilities values that are not arrays', () => {
		const errors = validateAddonCapabilities({
			platformCapabilities: { ios: 'native.objc.classes' },
		});

		expect(errors.join('\n')).toMatch(/platformCapabilities\.ios/);
	});

	test('rejects an unknown platformCapabilities platform', () => {
		const errors = validateAddonCapabilities({
			platformCapabilities: { web: ['native.java.classes'] },
		});

		expect(errors.join('\n')).toContain('web');
	});
});
