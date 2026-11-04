import { flux as fakeFlux, patches, startPlugin } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { flux } from '@unbound-app/api';

import * as plugin from '~/index';

function seedStore() {
	fakeFlux.seed({ MultiAccount: { getCanUseMultiAccountMobile: () => false } });

	return flux.getStore('MultiAccount');
}

test('replaces the mobile multi-account answer while the plugin runs', async () => {
	seedStore();
	await startPlugin();

	expect(patches.applied).toMatchObject([
		{ kind: 'instead', method: 'getCanUseMultiAccountMobile' },
	]);
});

test('tells what reads the store to ask again when it starts and stops', async () => {
	let changes = 0;

	seedStore().addChangeListener(() => changes++);

	await startPlugin();
	expect(changes).toBe(1);

	plugin.stop();
	expect(changes).toBe(2);
});
