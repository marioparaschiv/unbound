import { expect, test } from 'bun:test';

import { installUnboundNative, resetDevice } from '../helpers/addons';

const { Plugins } = await import('~/plugins/manager');
const { isKnownOwner } = await import('~/commands/owners');

function freezeListener() {
	return Reflect.get(globalThis, '__UnboundFreezeListener');
}

test('shutdown removes the freeze listener and owner check that initialize installs', async () => {
	resetDevice();
	installUnboundNative([]);

	const plugins = new Plugins();

	plugins.initialize();

	expect(freezeListener()).toBeFunction();
	expect(isKnownOwner('missing')).toBe(false);

	await plugins.shutdown();

	expect(freezeListener()).toBeUndefined();
	expect(isKnownOwner('missing')).toBe(true);
});
