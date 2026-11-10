// The bun preload of a plugin's tests: `preload = ["@unbound-app/api/testing/preset"]` in bunfig.toml.
import { afterEach, beforeEach, mock } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement } from 'react';
import * as React from 'react';
import { plugin } from 'bun';

import {
	assetNameOf,
	findEntry,
	findPluginRoot,
	readLocaleTables,
	readManifest,
} from './plugin-files';
import { createFakeDialogs, createFakeToasts, hasPlaceholders, KEY_LOOKUP } from './fake-feedback';
import { createFakeSettings, defineSettings, setting, type SettingsSchema } from './fake-settings';
import { createListenerRegistry, type ListenerRegistry } from './listener-registry';
import { createFakeReactNative, type HostPropsByName } from './fake-react-native';
import { installAddonGlobals, type FakeUnbound } from './install-addon-globals';
import { SOURCE_LOCALE } from '../src/_conventions/addon-locales';
import { ASSET_TYPES } from '../src/_conventions/addon-assets';
import { createFakeAssets, createFakeFlux } from './fake-api';
import { createJsxRuntimes } from './unfrozen-elements';
import { resetSession, startSession } from './session';
import { createFakeLocales } from './fake-locales';
import { createFakePlugins } from './fake-plugins';
import { forgetPlugin } from './plugin-lifecycle';
import { createFakeUi } from './fake-components';
import { createFakeNative } from './fake-native';
import { createFakeUtils } from './fake-utils';
import { unmountAll } from './test-renderer';
import { createFakeFs } from './fake-fs';

type SvgProps = Omit<HostPropsByName['SvgXml'], 'xml' | 'asset'>;

// The namespaces that serve nested modules, as `unbound.metro.components` is `@unbound-app/api/metro/components`.
const NESTED = new Map([
	['metro', ['api', 'common', 'components', 'filters', 'stores']],
	['utils', ['react']],
]);

// The build also takes `.jpeg` as a jpg.
const IMAGE = new RegExp(`\\.(${[...ASSET_TYPES, 'jpeg'].join('|')})$`, 'i');
const SVG = /\.svg$/i;
const SVG_ASSET = /\.svg\?asset$/i;
const SVG_ASSET_NAMESPACE = 'unbound-svg-asset';

function isSettingsSchema(value: unknown): value is SettingsSchema {
	return (
		typeof value === 'object' &&
		value !== null &&
		Reflect.get(value, 'kind') === 'settings' &&
		typeof Reflect.get(value, 'properties') === 'object'
	);
}

// The plugin-facing `storage` and `metro` track their listeners, so `stopPlugin` sees any left behind.
function trackedNamespaces(unbound: FakeUnbound, listeners: ListenerRegistry) {
	const { storage, metro } = unbound;

	return {
		storage: {
			...storage,
			onChange: (...args: Parameters<typeof storage.onChange>) =>
				listeners.track('storage.onChange', storage.onChange(...args)),
		},
		metro: {
			...metro,
			onModuleLoad: (listener: Parameters<typeof metro.onModuleLoad>[0]) =>
				listeners.track('metro.onModuleLoad', metro.onModuleLoad(listener)),
			onModuleLoaded: (...args: Parameters<typeof metro.onModuleLoaded>) =>
				listeners.track('metro.onModuleLoaded', metro.onModuleLoaded(...args)),
		},
	};
}

// Runs the export of the plugin's src/actions.ts a settings button names, as the client's panel does.
async function runAction(pluginRoot: string, name: string): Promise<void> {
	const path = join(pluginRoot, 'src', 'actions.ts');

	if (!existsSync(path)) {
		throw new Error(`Failed to run action ${name}: ${pluginRoot} has no src/actions.ts.`);
	}

	const actions: unknown = await import(path);
	const action =
		typeof actions === 'object' && actions !== null ? Reflect.get(actions, name) : void 0;

	if (typeof action !== 'function') {
		throw new Error(`Failed to run action ${name}: src/actions.ts exports no such function.`);
	}

	await action();
}

function resolveImport(root: string, path: string, importer: string): string {
	return path.startsWith('~/')
		? join(root, 'src', path.slice(2))
		: resolve(dirname(importer), path);
}

function svgComponent(asset: string, xml: string) {
	function SvgImage(props: SvgProps) {
		return createElement('SvgXml', { xml, asset, ...props });
	}

	SvgImage.displayName = `Svg(${asset})`;

	return SvgImage;
}

async function readSettings(root: string): Promise<SettingsSchema | undefined> {
	const path = join(root, 'settings.ts');

	if (!existsSync(path)) return;

	const module: unknown = await import(path);
	const schema: unknown =
		typeof module === 'object' && module !== null ? Reflect.get(module, 'default') : void 0;

	if (!isSettingsSchema(schema)) {
		throw new Error(`Failed to read ${path}: its default export is not defineSettings(...).`);
	}

	return schema;
}

const root = findPluginRoot();
const manifest = readManifest(root);
const listeners = createListenerRegistry();
const tables = readLocaleTables(root);
const locales = tables.size ? createFakeLocales(tables) : undefined;
const source = tables.get(SOURCE_LOCALE) ?? {};
const lookup = locales
	? { resolveMessage: locales.format, takesVars: (key: string) => hasPlaceholders(source[key]) }
	: KEY_LOOKUP;
const toasts = createFakeToasts(() => lookup);
const dialogs = createFakeDialogs(() => lookup);
const flux = createFakeFlux(listeners);
const assets = createFakeAssets(listeners);
const native = createFakeNative();
const fs = createFakeFs();
const reactNative = createFakeReactNative(() => native.state.platform);
const scope = installAddonGlobals({
	manifest,
	unbound: {
		toasts,
		dialogs,
		flux,
		assets,
		native: native.namespace,
		ui: createFakeUi(),
		utils: createFakeUtils(),
		fs,
	},
});

const plugins = createFakePlugins(scope.addon.manifest);

scope.unbound.plugins = plugins.namespace;
Object.assign(scope.unbound, trackedNamespaces(scope.unbound, listeners));
// On device the scope's `React` is Discord's real one; the fake one cannot re-render.
Reflect.set(globalThis, 'React', React);
Object.assign(scope.metro.common, { React, ReactNative: reactNative });
Object.assign(scope.metro.stores, {
	Accessibility: flux.getStore('Accessibility'),
	Theme: flux.getStore('Theme'),
	Users: flux.getStore('User'),
	Guilds: flux.getStore('Guild'),
});

mock.module('react-native', () => reactNative);
mock.module('@unbound-app/api', () => scope.unbound);

for (const [name, namespace] of Object.entries(scope.unbound)) {
	mock.module(`@unbound-app/api/${name}`, () => namespace);

	// A namespace that nests others serves each one at its own path, such as `@unbound-app/api/metro/components`.
	for (const [nested, members] of Object.entries(namespace)) {
		if (NESTED.get(name)?.includes(nested)) {
			mock.module(`@unbound-app/api/${name}/${nested}`, () => members);
		}
	}
}

for (const [specifier, runtime] of Object.entries(createJsxRuntimes())) {
	mock.module(specifier, () => runtime);
}

if (locales) {
	mock.module('@unbound-app/i18n', () => ({
		messages: locales.messages,
		format: locales.format,
		useMessages: locales.useMessages,
	}));
}

mock.module('@unbound-app/settings/schema', () => ({
	setting,
	defineSettings,
	default: { setting, defineSettings },
}));

const schema = await readSettings(root);
const settings = schema
	? createFakeSettings(schema, scope.storage, scope.addon.id, {
			translate: (key) => locales?.messages[key] ?? key,
			runAction: (name) => runAction(root, name),
		})
	: undefined;

if (settings) {
	mock.module('@unbound-app/settings', () => ({
		settings: settings.settings,
		useSetting: settings.useSetting,
		resetSettings: settings.resetSettings,
		SettingsPanel: settings.SettingsPanel,
		getSettingsPanel: settings.getSettingsPanel,
	}));
}

plugin({
	name: 'unbound-test-assets',
	setup(build) {
		build.onResolve({ filter: SVG_ASSET }, ({ path, importer }) => ({
			path: resolveImport(root, path.slice(0, -'?asset'.length), importer),
			namespace: SVG_ASSET_NAMESPACE,
		}));
		build.onLoad({ filter: /.*/, namespace: SVG_ASSET_NAMESPACE }, ({ path }) => ({
			loader: 'object',
			exports: { default: assets.getIdByName(assetNameOf(root, path), 'png') },
		}));
		build.onLoad({ filter: IMAGE }, ({ path }) => ({
			loader: 'object',
			exports: { default: assets.getIdByName(assetNameOf(root, path)) },
		}));
		build.onLoad({ filter: SVG }, ({ path }) => ({
			loader: 'object',
			exports: { default: svgComponent(assetNameOf(root, path), readFileSync(path, 'utf8')) },
		}));
	},
});

startSession({
	root,
	entry: findEntry(root),
	scope,
	listeners,
	toasts,
	dialogs,
	flux,
	assets,
	locales,
	settings,
	native,
	plugins,
	fs,
});

beforeEach(() => {
	forgetPlugin();
	resetSession();
});

afterEach(unmountAll);
