import { afterEach, describe, expect, mock, test } from 'bun:test';
import { ADDON_KINDS } from '@unbound-app/types/addons';

import { loadManagers, makeManifest, openedBuckets } from './helpers/addons';
import { createHookRenderer } from './helpers/render-hook';

const { React, renderHook } = createHookRenderer();

mock.module('react', () => React);

const Manager = await loadManagers();

const { default: useDevelopmentCopy } = await import('~/ui/hooks/use-development-copy');
const { default: useAddonState } = await import('~/ui/hooks/use-addon-state');
const { installsFromManifest } = await import('~/addons/addons');

const LISTED_KINDS = ['plugin', 'theme', 'icon-pack'] as const;
const mounted: { unmount: () => void }[] = [];

function render<T>(hook: () => T) {
	const rendered = renderHook(hook);

	mounted.push(rendered);

	return rendered;
}

afterEach(() => {
	for (const rendered of mounted.splice(0)) rendered.unmount();
});

test('resolves the manager of every addon kind', () => {
	for (const kind of ADDON_KINDS) {
		expect(Manager.for(kind).kind).toBe(kind);
	}
});

test('updates every kind installed from a manifest, and not fonts', () => {
	expect(ADDON_KINDS.filter(installsFromManifest)).toEqual(['plugin', 'theme', 'icon-pack']);
});

test('keeps each manager on the bucket name it has always persisted to', () => {
	const buckets = Object.fromEntries(ADDON_KINDS.map((kind) => [kind, Manager.for(kind).bucket]));

	expect(buckets).toEqual({
		plugin: 'plugins',
		theme: 'themes',
		'icon-pack': 'icons',
		font: 'fonts',
	});
	expect(openedBuckets).toEqual(['plugins', 'themes', 'icons', 'fonts']);
});

describe('addon hooks', () => {
	for (const kind of LISTED_KINDS) {
		test(`re-render ${kind} addons when their enabled state changes, and not on other records`, () => {
			const manager = Manager.for(kind);
			const id = `${kind}.state`;

			manager.load('({})', makeManifest(id));

			const state = render(() => useAddonState(kind, id));

			manager.markDevelopmentCopy(id);
			expect(state.renders).toBe(1);

			manager.disable(id);
			expect(state.renders).toBeGreaterThan(1);
			expect(state.current.enabled).toBe(false);
		});

		test(`re-render ${kind} addons when their development markers change, and not on holds`, () => {
			const manager = Manager.for(kind);
			const id = `${kind}.development`;
			const copy = render(() => useDevelopmentCopy(kind, id));

			manager.holdVersion(id, '1.0.0');
			expect(copy.renders).toBe(1);

			manager.markDevelopmentCopy(id);
			expect(copy.renders).toBe(2);
			expect(copy.current).toBe(true);
		});
	}
});
