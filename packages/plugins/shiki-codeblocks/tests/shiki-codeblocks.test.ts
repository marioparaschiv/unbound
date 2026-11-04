import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { flux, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';

let errors = spyOn(console, 'error');

beforeEach(() => {
	errors = spyOn(console, 'error').mockImplementation(() => {});
	flux.seed({ Message: {}, SelectedChannel: { getChannelId: () => '1' } });
});

afterEach(() => {
	errors.mockRestore();
});

test('stays out of Discord on iOS when its message classes are missing', async () => {
	await startPlugin();

	expect(native.calls.map(({ target }) => target)).toContain('DCDMessageTableViewCell');
	expect(errors.mock.calls.flat().join(' ')).toContain('native classes not found');
	await stopPlugin();
});

test('stays out of Discord when the loader grants no native capability', async () => {
	native.setPlatform('android');
	await startPlugin({ capabilities: ['native.java.associations'], native: { capabilities: [] } });

	expect(errors.mock.calls.flat().join(' ')).toContain('native capabilities not available');
	await stopPlugin();
});
