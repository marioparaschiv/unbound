import { describe, expect, test } from 'bun:test';

import type { MetroModulePresence } from '~/metro/types';

const { createLazyModule, getLoadedModule } = await import('~/metro/lazy-registry');

type Store = { name: string };

function lazyHandle(module: Store, initial: MetroModulePresence) {
	let presence = initial;
	let searches = 0;
	const handle = createLazyModule(
		() => {
			searches++;

			return module;
		},
		{ wait: () => () => undefined, presence: () => presence },
	);

	return {
		handle,
		searches: () => searches,
		load: () => void (presence = 'loaded'),
	};
}

describe('getLoadedModule', () => {
	test('gives nothing and runs no search while the module has not loaded', () => {
		const lazy = lazyHandle({ name: 'store' }, 'present');

		expect(getLoadedModule(lazy.handle)).toBeUndefined();
		expect(lazy.searches()).toBe(0);
	});

	test('gives the real module once it has loaded', () => {
		const store = { name: 'store' };
		const lazy = lazyHandle(store, 'unknown');

		lazy.load();

		expect(getLoadedModule(lazy.handle)).toBe(store);
		expect(getLoadedModule(lazy.handle)).toBe(store);
		expect(lazy.searches()).toBe(1);
	});

	test('gives the module of a handle already resolved through the proxy', () => {
		const store = { name: 'store' };
		const lazy = lazyHandle(store, 'present');

		expect(lazy.handle.name).toBe('store');
		expect(getLoadedModule(lazy.handle)).toBe(store);
	});

	test('gives a resolved multi-module handle, and passes a plain value through', () => {
		const found = [{ id: 1 }];
		const handle = createLazyModule(() => found);
		const plain = { plain: true };

		expect(getLoadedModule(handle)).toBeUndefined();
		expect(handle.length).toBe(1);
		expect(getLoadedModule(handle)).toBe(found);
		expect(getLoadedModule(plain)).toBe(plain);
		expect(getLoadedModule(null)).toBeNull();
	});
});
