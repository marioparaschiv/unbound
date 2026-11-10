import { flux as fakeFlux, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { flux } from '@unbound-app/api';

import { MultiAccountStore } from '~/multi-account/modules';
import { selfTest } from '~/index';
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
	const answers: boolean[] = [];
	const store = seedStore();

	flux.onStoreChange(store, () => answers.push(store.getCanUseMultiAccountMobile()));

	await startPlugin();
	expect(answers).toEqual([true]);

	await stopPlugin();
	// What a listener reads at stop is the real answer, not the patched one.
	expect(answers).toEqual([true, false]);
});

test('reports healthy after it starts', async () => {
	seedStore();

	await startPlugin();

	expect((await selfTest()).ok).toBe(true);
});

test('skips quietly when Discord renamed the store method', async () => {
	fakeFlux.seed({ MultiAccount: {} });

	await startPlugin();

	expect((await selfTest()).ok).toBe(false);
	await stopPlugin();
});
