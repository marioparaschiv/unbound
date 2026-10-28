import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { FakeAddons, makeManifest, resetDevice, states } from './helpers/addons';

const { createPatcher, unpatchAllByCaller } = await import('~/api/patcher');

type Greeter = {
	greet: (name: string) => string;
};

const target: Greeter = { greet: (name) => `hello ${name}` };

class PatchingAddons extends FakeAddons {
	protected handleBundle(bundle: string) {
		return {
			start: () => {
				createPatcher(bundle).after(target, 'greet', ({ result }) => `${result}!`);
			},
			stop: () => {},
		};
	}
}

beforeEach(() => {
	resetDevice();
	states['leaky.a'] = true;
	states['leaky.b'] = true;
});

afterEach(() => {
	unpatchAllByCaller('leaky.a');
	unpatchAllByCaller('leaky.b');
});

describe('stopping an addon', () => {
	test('removes the patches it left behind under its id', () => {
		const manager = new PatchingAddons();

		manager.load('leaky.a', makeManifest('leaky.a'));
		manager.load('leaky.b', makeManifest('leaky.b'));
		expect(target.greet('you')).toBe('hello you!!');

		manager.stop('leaky.a');
		expect(target.greet('you')).toBe('hello you!');

		manager.stop('leaky.b');
		expect(target.greet('you')).toBe('hello you');
	});

	test('still unpatches where Set iterators have no helpers, as on older Hermes', () => {
		const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(new Set().values()));
		const filter = Object.getOwnPropertyDescriptor(iteratorPrototype, 'filter');
		const manager = new PatchingAddons();

		manager.load('leaky.a', makeManifest('leaky.a'));
		Reflect.deleteProperty(iteratorPrototype, 'filter');

		try {
			expect(Reflect.has(new Set().values(), 'filter')).toBe(false);
			manager.stop('leaky.a');
			expect(target.greet('you')).toBe('hello you');
			expect(manager.errors.has('leaky.a')).toBe(false);
		} finally {
			if (filter) {
				Object.defineProperty(iteratorPrototype, 'filter', filter);
			}
		}
	});
});
