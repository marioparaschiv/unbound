import { beforeEach, expect, test } from 'bun:test';
import { flux, logs, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';

const logged = () => logs.entries.flatMap(({ args }) => args).join(' ');

beforeEach(() => {
	flux.seed({ Message: {}, SelectedChannel: { getChannelId: () => '1' } });
});

test('stays out of Discord on iOS when its message classes are missing', async () => {
	await startPlugin();

	expect(native.calls.map(({ target }) => target)).toContain('DCDMessageTableViewCell');
	expect(logged()).toContain('native classes not found');
	await stopPlugin();
});

test('stays out of Discord when the loader grants no native capability', async () => {
	native.setPlatform('android');
	await startPlugin({ capabilities: ['native.java.associations'], native: { capabilities: [] } });

	expect(logged()).toContain('native capabilities not available');
	await stopPlugin();
});
