import { describe, expect, test } from 'bun:test';

const { capabilityUse, markUIScope, trackCapabilities } = await import('~/native/capability-use');

describe('capability use', () => {
	test('lists declared capabilities a plugin never called', () => {
		const use = trackCapabilities('test.plugin', ['native.objc.classes', 'native.objc.hooks']);

		use('native.objc.classes');
		use('native.objc.classes');
		markUIScope('test.plugin');

		expect(capabilityUse().find((entry) => entry.plugin === 'test.plugin')).toEqual({
			plugin: 'test.plugin',
			declared: ['native.objc.classes', 'native.objc.hooks'],
			used: ['native.objc.classes'],
			unused: ['native.objc.hooks'],
			uiScope: true,
		});
	});
});
