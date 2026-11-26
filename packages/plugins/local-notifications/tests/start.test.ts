import { expect, test } from 'bun:test';
import { flux, logs, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';

const logged = () => logs.entries.flatMap(({ args }) => args).join(' ');

test('stays off with one warning when the loader lacks its native capabilities', async () => {
	await startPlugin({ capabilities: ['native.objc.hooks'], native: { capabilities: [] } });

	expect(logged()).toContain('native capabilities not available: native.objc.hooks');

	await flux.dispatch({
		type: 'MESSAGE_CREATE',
		message: { id: '2', channel_id: '1', author: { id: '3' } },
	} as Parameters<typeof flux.dispatch>[0]);

	expect(native.calls).toEqual([]);
	await stopPlugin();
});
