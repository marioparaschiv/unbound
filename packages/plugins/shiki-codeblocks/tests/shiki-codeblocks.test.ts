import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { flux, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';

// The testing kit's react-native has no AppState or AppRegistry, which the native card code reads; the
// plugin's own components are not drawn here.
mock.module('react-native', () => ({
	AppState: { addEventListener: () => ({ remove: () => {} }) },
	AppRegistry: { registerComponent: () => {}, getRunnable: () => undefined },
	Image: 'Image',
	Pressable: 'Pressable',
	ScrollView: 'ScrollView',
	Text: 'Text',
	View: 'View',
}));

let errors = spyOn(console, 'error');

beforeEach(() => {
	errors = spyOn(console, 'error').mockImplementation(() => {});
	flux.seed({ Message: {}, SelectedChannel: { getChannelId: () => '1' } });
});

afterEach(() => {
	errors.mockRestore();
});

test('stays out of Discord on iOS when its message classes are missing', async () => {
	const classes: string[] = [];

	await startPlugin({
		native: {
			objc: {
				getClass: (name: string) => void classes.push(name),
			} as never,
		},
	});

	expect(classes).toContain('DCDMessageTableViewCell');
	expect(errors.mock.calls.flat().join(' ')).toContain('native classes not found');
	await stopPlugin();
});

test('stays out of Discord when the loader grants no native capability', async () => {
	native.setPlatform('android');
	await startPlugin({ capabilities: ['native.java.associations'], native: { capabilities: [] } });

	expect(errors.mock.calls.flat().join(' ')).toContain('native capabilities not available');
	await stopPlugin();
});
