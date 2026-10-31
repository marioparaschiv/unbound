import { describe, expect, test } from 'bun:test';

import { resolvePlatforms } from '~/lib/addon-platforms';

describe('resolvePlatforms', () => {
	test('lists each platform in platforms with its own Capabilities', () => {
		expect(
			resolvePlatforms({
				platforms: {
					android: { capabilities: ['native.java.invoke'] },
					ios: { capabilities: ['native.objc.invoke', 'native.objc.hooks'] },
				},
				capabilities: ['native.ffi.call'],
				platformCapabilities: { ios: ['native.objc.ivars'] },
			}),
		).toEqual([
			{ platform: 'ios', capabilities: ['native.objc.invoke', 'native.objc.hooks'] },
			{ platform: 'android', capabilities: ['native.java.invoke'] },
		]);
	});

	test('shows a platform that needs no Capabilities with an empty list', () => {
		expect(resolvePlatforms({ platforms: { ios: {} } })).toEqual([
			{ platform: 'ios', capabilities: [] },
		]);
	});

	test('reads platformCapabilities on top of the flat list for a platform list', () => {
		expect(
			resolvePlatforms({
				platforms: ['android', 'ios'],
				capabilities: ['native.ffi.call'],
				platformCapabilities: { ios: ['native.objc.invoke', 'native.ffi.call'] },
			}),
		).toEqual([
			{ platform: 'ios', capabilities: ['native.ffi.call', 'native.objc.invoke'] },
			{ platform: 'android', capabilities: ['native.ffi.call'] },
		]);
	});

	test('falls back to the flat Capabilities on every platform for the oldest manifests', () => {
		expect(resolvePlatforms({ capabilities: ['native.runtime.events'] })).toEqual([
			{ platform: 'ios', capabilities: ['native.runtime.events'] },
			{ platform: 'android', capabilities: ['native.runtime.events'] },
		]);
		expect(resolvePlatforms({})).toEqual([
			{ platform: 'ios', capabilities: [] },
			{ platform: 'android', capabilities: [] },
		]);
	});
});
