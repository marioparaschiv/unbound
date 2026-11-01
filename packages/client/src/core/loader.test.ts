import { expect, test } from 'bun:test';

import deferUntilReady from './loader';

type ReadyState = {
	ready: boolean;
	callbacks: Array<() => void>;
};

function createRequire(handler: (id: number | string) => void): MetroRequire {
	return Object.assign(handler, { importAll: handler });
}

test('fails loudly when Discord has already run its bundle', () => {
	globalThis.__r = createRequire(() => undefined);

	try {
		expect(() => deferUntilReady(() => undefined)).toThrow(
			"Unbound's bundle ran after Discord's.",
		);
	} finally {
		Reflect.deleteProperty(globalThis, '__r');
	}
});

test("initializes right after Discord's main module, then releases readiness callbacks", async () => {
	const state = (globalThis as typeof globalThis & { __unboundReady?: ReadyState })
		.__unboundReady;

	if (!state) {
		throw new Error('Readiness state was not installed.');
	}

	const events: string[] = [];

	state.callbacks.push(() => events.push('ready'));

	try {
		deferUntilReady(async () => {
			events.push('initialize');
		});

		globalThis.__r = createRequire((id) => {
			events.push(`discord:${id}`);
		});

		globalThis.__r(118);
		globalThis.__r(0);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(events).toEqual(['discord:118', 'discord:0', 'initialize', 'ready']);
		expect(state.ready).toBe(true);
		expect(state.callbacks).toHaveLength(0);
	} finally {
		Reflect.deleteProperty(globalThis, '__r');
		Reflect.deleteProperty(globalThis, '__d');
		state.ready = false;
	}
});

test("takes Metro's registry at the first read of __d, before any module is defined", () => {
	const registry = new Map<number, MetroModuleRecord>();
	let collected = 0;

	try {
		deferUntilReady(() => undefined);

		globalThis.__d = () => undefined;
		globalThis.__c = () => {
			collected++;

			return registry;
		};

		expect(collected).toBe(0);

		globalThis.__d(() => undefined, 1, []);
		globalThis.__d(() => undefined, 2, []);

		expect(collected).toBe(1);
		expect(globalThis.modules).toBe(registry);
		expect(Object.getOwnPropertyDescriptor(globalThis, '__d')).toMatchObject({
			writable: true,
		});
	} finally {
		Reflect.deleteProperty(globalThis, '__r');
		Reflect.deleteProperty(globalThis, '__d');
		Reflect.deleteProperty(globalThis, '__c');
		Reflect.deleteProperty(globalThis, 'modules');
	}
});
