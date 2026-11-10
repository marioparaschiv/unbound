import { expect, test } from 'bun:test';

import { selfTest } from '~/index';

import { dispatch, generateRow, startLogger } from './helpers/discord';
const isMarkedDeleted = () => generateRow().ephemeralIndication !== undefined;

test('reports healthy once every feature has started', async () => {
	await startLogger();

	expect(selfTest()).toEqual({ ok: true, detail: '6 features applied' });
});

test('leaves the other features running when one fails to start', async () => {
	// Discord's action sheets module, whose `openLazy` fails once the plugin reads it.
	const sheets = { hideActionSheet: () => {} };
	let started = false;

	Object.defineProperty(sheets, 'openLazy', {
		get() {
			if (started) throw new Error('openLazy is gone');

			return () => {};
		},
	});
	started = true;
	await startLogger(sheets);

	await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });

	expect(isMarkedDeleted()).toBe(true);
	expect((await selfTest()).ok).toBe(false);
});
