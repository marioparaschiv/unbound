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
		const errors = validateAddonCapabilities({
			platforms: { ios: { capabilities: ['native.objc.unknown'] } },
		});

		expect(errors).toEqual([
			'platforms.ios contains an unsupported value: native.objc.unknown',
		]);
	});

	test('rejects a flat Capability that only one platform can provide', () => {
		const errors = validateAddonCapabilities({ capabilities: [iosOnlyCapability] });

		expect(errors).toEqual([
			`capabilities contains ${iosOnlyCapability}, which android cannot provide; declare it under platforms.ios.capabilities`,
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
		).toEqual([`platforms.android cannot provide ${iosOnlyCapability}`]);
	});

	test('rejects capabilities that are not arrays', () => {
		expect(
			validateAddonCapabilities({
				platforms: { ios: { capabilities: 'native.objc.classes' } },
			}),
		).toEqual(['platforms.ios must be an array']);
	});

	test('rejects platforms that are not supported targets', () => {
		expect(validateAddonCapabilities({ platforms: { web: {} } })).toEqual([
			'platforms contains an unsupported platform: web',
			'platforms must not be empty',
		]);
	});

	test('rejects empty platforms', () => {
		expect(validateAddonCapabilities({ platforms: {} })).toEqual([
			'platforms must not be empty',
		]);
	});

	test('rejects the list form of platforms', () => {
		expect(validateAddonCapabilities({ platforms: ['ios'] })).toEqual([
			'platforms must be an object',
		]);
	});

	test('rejects a platform entry that is not an object', () => {
		expect(validateAddonCapabilities({ platforms: { ios: [] } })).toEqual([
			'platforms.ios must be an object',
		]);
	});
});
