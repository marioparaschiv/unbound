import type { ReactNode } from 'react';

import type { PluginLocale, SettingsOverrides } from './plugin-types';
import type { SettingValue } from './fake-settings';
import type { FakeModule } from './fake-metro';
import type { StoreSeeds } from './fake-api';

import { act, createTestRenderer } from './test-renderer';
import { queriesOf, type Queries } from './test-node';
import { getSession } from './session';

/** What `render` sets up before the first render. */
export type RenderOptions = {
	/** Settings to store first; the rest read their defaults. */
	settings?: SettingsOverrides;
	/** The locale `@unbound-app/i18n` reads. */
	locale?: PluginLocale;
	/** Flux stores `flux.getStore` and `flux.useStore` read, such as `{ User: { getCurrentUser: () => user } }`. */
	stores?: StoreSeeds;
};

/** A mounted tree: queries over it, and the operations a test drives it with. */
export type RenderResult = Queries & {
	/** Renders a new element in place; components of the same type keep their state. */
	rerender: (element: ReactNode) => void;
	/** Unmounts the tree, running every effect's cleanup. The preset unmounts what a test leaves mounted. */
	unmount: () => void;
	/** Runs an interaction with renders held back, then renders once. */
	act: typeof act;
};

function isLeaf(value: unknown): value is SettingValue {
	return typeof value !== 'object' || value === null || Array.isArray(value);
}

function applySettings(overrides: FakeModule, prefix = '') {
	const { settings } = getSession();

	if (!settings) {
		throw new Error('Failed to apply render settings: the plugin has no settings.ts.');
	}

	for (const [key, value] of Object.entries(overrides)) {
		const path = prefix ? `${prefix}.${key}` : key;

		if (isLeaf(value)) {
			settings.set(path, value);
		} else {
			applySettings(value, path);
		}
	}
}

/**
 * @description Renders an element with the plugin's fakes, after storing `settings`, switching to `locale` and
 * seeding `stores`. Host components from `react-native` stay plain nodes `find` reaches by name.
 * @param element The element, such as `<GreetingTitle />`.
 * @param options The settings, locale and stores to set up first.
 * @returns Queries over the tree, and `rerender`, `unmount` and `act`.
 */
export function render(element: ReactNode, options: RenderOptions = {}): RenderResult {
	const session = getSession();

	if (options.stores) {
		session.flux.seed(options.stores);
	}

	if (options.settings) {
		applySettings(options.settings);
	}

	if (options.locale !== undefined) {
		session.locales?.setLocale(String(options.locale));
	}

	const renderer = createTestRenderer(element);

	return {
		...queriesOf(renderer.root),
		rerender: (next) => act(() => renderer.update(next)),
		unmount: renderer.unmount,
		act,
	};
}
