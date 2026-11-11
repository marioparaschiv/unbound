import { logs } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';

import { startLogger } from './helpers/discord';

test('starts every feature without a warning, so the self test passes', async () => {
	await startLogger();

	expect(logs.entries.filter((entry) => entry.level === 'warn')).toEqual([]);
});

test('fails to start when a feature throws', async () => {
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

	await expect(startLogger(sheets)).rejects.toThrow('openLazy is gone');
});
