import { flux as fakeFlux, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { flux } from '@unbound-app/api';

import { MultiAccountStore } from '~/multi-account/modules';

function seedStore() {
	fakeFlux.seed({ MultiAccount: { getCanUseMultiAccountMobile: () => false } });

	return MultiAccountStore;
}

test('reports multi-account as available on mobile while the plugin runs', async () => {
	const store = seedStore();

	expect(store.getCanUseMultiAccountMobile()).toBe(false);

	await startPlugin();
	expect(store.getCanUseMultiAccountMobile()).toBe(true);

	await stopPlugin();
	expect(store.getCanUseMultiAccountMobile()).toBe(false);
});

test('tells what reads the store to ask again when it starts and stops', async () => {
	let changes = 0;

	flux.onStoreChange(seedStore(), () => changes++);

	await startPlugin();
	expect(changes).toBe(1);

	await stopPlugin();
	expect(changes).toBe(2);
});
