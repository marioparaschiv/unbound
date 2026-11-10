import { describe, expect, test } from 'bun:test';

import { resolvePlatforms } from '~/lib/addon-platforms';

describe('resolvePlatforms', () => {
	test('lists each platform in platforms with the flat Capabilities and its own', () => {
		expect(
			resolvePlatforms({
				platforms: {
					android: { capabilities: ['native.java.invoke'] },
					ios: { capabilities: ['native.objc.invoke', 'native.ffi.call'] },
				},
				capabilities: ['native.ffi.call'],
			}),
		).toEqual([
			{ platform: 'ios', capabilities: ['native.ffi.call', 'native.objc.invoke'] },
			{ platform: 'android', capabilities: ['native.ffi.call', 'native.java.invoke'] },
		]);
	});

	test('shows a platform that needs no Capabilities with an empty list', () => {
		expect(resolvePlatforms({ platforms: { ios: {} } })).toEqual([
			{ platform: 'ios', capabilities: [] },
		]);
	});

	test('runs the flat Capabilities on every platform without platforms', () => {
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
