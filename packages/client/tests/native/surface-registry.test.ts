import type { NativeFabricSurface } from '@unbound-app/types';
import { describe, expect, mock, test } from 'bun:test';

import { createTrackedSurfaces, unmountLiveSurfaces } from '~/native/surface-registry';

function surface(): NativeFabricSurface {
	return Object.create(null);
}

describe('surface registry', () => {
	test('unmounts the surfaces scopes still hold, once', async () => {
		const unmount = mock((_surface: NativeFabricSurface) => Promise.resolve());
		const surfaces = createTrackedSurfaces(unmount);
		const kept = surface();
		const removed = surface();

		surfaces.add(kept);
		surfaces.add(removed);
		surfaces.delete(removed);

		await unmountLiveSurfaces();
		await unmountLiveSurfaces();

		expect(unmount.mock.calls).toEqual([[kept]]);
	});

	test('stops waiting for an unmount that never settles', async () => {
		const surfaces = createTrackedSurfaces(() => new Promise<void>(() => undefined));

		surfaces.add(surface());

		await unmountLiveSurfaces(10);
	});
});
