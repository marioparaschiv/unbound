import * as React from 'react';

import type { AnyObject } from '../src/patcher';

import { createFakeReactNative } from './fake-react-native';
import { createFakeComponents } from './fake-components';

/** A module the fake metro serves: the exports a plugin finds. */
export type FakeModule = AnyObject;

/** A fake metro filter. `path` marks a file-path filter, which matches the path a module was registered under. */
export type FakeFilter = ((module: FakeModule) => boolean) & { path?: string };

type LazyOptions = {
	signal?: AbortSignal;
};

type FindOptions = {
	lazy?: boolean;
	all?: boolean;
};

type FindAll = { all: true };

type Presence = 'loaded' | 'missing';

const LAZY_MARKER = '__METRO_LAZY__';

// The props each `metro.common` member is found by, as in the client's metro/common.ts.
const COMMON_PROPS = {
	Reanimated: ['useAnimatedStyle', 'useSharedValue'],
	Gestures: ['PanGestureHandler'],
	Clipboard: ['setString', 'getString', 'setImage', 'getImage'],
	MarkdownParser: ['parse', 'parseToAST', 'reactParserFor'],
	Screens: ['FullWindowOverlay'],
	SVG: ['Svg', 'Path'],
	Commands: ['getBuiltInCommands'],
	Moment: ['isMoment'],
	Util: ['inspect'],
	Assets: ['registerAsset'],
	ImageSources: ['getImageSourcesFromImageProps'],
	Clyde: ['createBotMessage'],
	Constants: ['Fonts', 'Endpoints'],
	Radius: ['Radius'],
	Theme: ['colors', 'internal'],
	REST: ['getAPIBaseURL'],
	i18n: ['getLanguages', 'getSystemLocale', 'intl'],
};

// The props each `metro.api` member is found by, as in the client's metro/api.ts.
const API_PROPS = {
	Messages: ['sendMessage', 'receiveMessage'],
	Linking: ['openURL', 'openSettings'],
	Profiles: ['showUserProfile'],
	AsyncUsers: ['fetchProfile'],
	Invites: ['acceptInviteAndTransitionToInviteChannel'],
	OAuth2: ['openOAuth2Modal'],
	ActionSheets: ['openLazy', 'hideActionSheet'],
	UserProfiles: ['getUserProfileActionSheetKey', 'showUserProfileActionSheetPostConnection'],
};

/** What a lazy handle looks its module up by. */
type LazyLookup = {
	resolve: () => FakeModule | undefined;
	filter: FakeFilter;
};

type Wait = {
	filter: FakeFilter;
	onLoad: (module: FakeModule) => void;
};

/** A metro over modules a test registers, with the finders and filters plugins call. */
export type FakeMetro = {
	/** Adds a module, settling any `findLazy` or `onModuleLoaded` waiting for it and calling `onModuleLoad` listeners. */
	register: (module: FakeModule, path?: string) => void;
	/** Forgets every registered module and waiting `findLazy` or `onModuleLoaded`, so a lazy handle made earlier finds only what is registered next. */
	reset: () => void;
	/** Discord's Flux stores, by the name `metro.stores` gives them, such as `Users`; the preset binds each to the seeded store. */
	stores: Record<string, FakeModule>;
	/** Discord's components: each module a bag of fake components that draw their children and are found by name, such as `Discord.Text`. */
	components: FakeModule;
	/** Discord's API modules, each a lazy handle found by the same props as on device, such as `Messages`. */
	api: Record<keyof typeof API_PROPS, FakeModule>;
	/** Discord's common modules, each a lazy handle found by the same props as on device, such as `Theme`; `React` and `ReactNative` are the fakes. */
	common: Record<keyof typeof COMMON_PROPS, FakeModule> & {
		React: FakeModule;
		ReactNative: FakeModule;
	};
	filters: {
		byProps: (...props: string[]) => FakeFilter;
		byName: (name: string) => FakeFilter;
		byDisplayName: (name: string) => FakeFilter;
		byTypeName: (name: string) => FakeFilter;
		byFilePath: (path: string) => FakeFilter;
		all: (...parts: FakeFilter[]) => FakeFilter;
		any: (...parts: FakeFilter[]) => FakeFilter;
		not: (part: FakeFilter) => FakeFilter;
	};
	/** A lazy handle to the first registered module the filter matches, as on device; `lazy: false` gives the module now, and `all: true` every match now. */
	find: {
		(filter: FakeFilter, options: FindAll): FakeModule[];
		(filter: FakeFilter, options?: FindOptions): FakeModule | undefined;
	};
	findByProps: (...args: (string | FindOptions)[]) => FakeModule | undefined;
	findByName: (...args: (string | FindOptions)[]) => FakeModule | undefined;
	findByFilePath: (...args: (string | FindOptions)[]) => FakeModule | undefined;
	/** `loaded` once a registered module matches a lazy handle, `missing` before; `undefined` for anything else. */
	// UNKNOWN: a plugin may pass any value, and only a lazy handle has a presence.
	getModulePresence: (handle: unknown) => Presence | undefined;
	findLazy: (
		filter: FakeFilter,
		options?: LazyOptions,
	) => FakeModule | Promise<FakeModule | undefined>;
	onModuleLoaded: (filter: FakeFilter, onLoad: (module: FakeModule) => void) => () => void;
	/** Calls `onLoad` with the module a lazy handle finds, at once when one is registered, else when it registers; a plain object is passed at once. Returns what stops waiting. */
	whenLoaded: (target: FakeModule, onLoad: (module: FakeModule) => void) => () => void;
	onModuleLoad: (listener: (module: FakeModule) => void) => () => void;
};

function names(args: (string | FindOptions)[]): string[] {
	return args.filter((arg) => typeof arg === 'string');
}

// The client rejects a file-path filter inside a combination, because it matches the raw module record, not exports.
function assertCombinable(kind: 'all' | 'any' | 'not', part: FakeFilter) {
	if (part.path !== undefined) {
		throw new TypeError(
			`Failed to combine filters: ${kind}() cannot take a raw filter such as byFilePath.`,
		);
	}
}

function isEager(args: (string | FindOptions)[]): boolean {
	return args.some((arg) => typeof arg === 'object' && arg.lazy === false);
}

// A lookup the plugin makes while it loads, as on device: each access reads the module registered by then.
function lazyHandle(resolve: () => FakeModule | undefined, description: string): FakeModule {
	const current = () => resolve() ?? {};

	return new Proxy<FakeModule>(
		{},
		{
			get: (_target, key) => Reflect.get(current(), key),
			has: (_target, key) => key in current(),
			ownKeys: () => Reflect.ownKeys(current()),
			getOwnPropertyDescriptor(_target, key) {
				if (key === LAZY_MARKER) {
					return { value: true, configurable: true };
				}

				const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);

				return descriptor && { ...descriptor, configurable: true };
			},
			set(_target, key, value) {
				const module = resolve();

				if (!module) {
					throw new Error(
						`Failed to set ${String(key)}: no module matches ${description}. Call metro.register() before the plugin starts.`,
					);
				}

				return Reflect.set(module, key, value);
			},
		},
	);
}

/**
 * @description Creates a metro that finds only the modules a test registers.
 * @returns The fake metro.
 */
export function createFakeMetro(): FakeMetro {
	const modules: FakeModule[] = [];
	const paths = new Map<FakeModule, string>();
	const waits = new Set<Wait>();
	const listeners = new Set<(module: FakeModule) => void>();

	const filters: FakeMetro['filters'] = {
		byProps:
			(...props) =>
			(module) =>
				props.every((prop) => prop in module),
		byName: (name) => (module) => 'name' in module && module.name === name,
		byDisplayName: (name) => (module) => module.displayName === name,
		byTypeName: (name) => (module) => module.type?.name === name,
		byFilePath: (path) =>
			Object.assign((module: FakeModule) => paths.get(module) === path, { path }),
		all: (...parts) => {
			for (const part of parts) assertCombinable('all', part);

			return (module) => parts.every((part) => part(module));
		},
		any: (...parts) => {
			for (const part of parts) assertCombinable('any', part);

			return (module) => parts.some((part) => part(module));
		},
		not: (part) => {
			assertCombinable('not', part);

			return (module) => !part(module);
		},
	};

	const handles = new WeakMap<FakeModule, LazyLookup>();

	function first(filter: FakeFilter): FakeModule | undefined {
		return modules.find((module) => filter(module));
	}

	function find(filter: FakeFilter, options: FindAll): FakeModule[];
	function find(filter: FakeFilter, options?: FindOptions): FakeModule | undefined;
	function find(filter: FakeFilter, options: FindOptions = {}) {
		return lookup(filter, 'the filter', [options]);
	}

	function lookup(filter: FakeFilter, description: string, options: (string | FindOptions)[]) {
		if (options.some((arg) => typeof arg === 'object' && arg.all)) {
			return modules.filter((module) => filter(module));
		}

		if (isEager(options)) {
			return first(filter);
		}

		const resolve = () => first(filter);
		const handle = lazyHandle(resolve, description);

		handles.set(handle, { resolve, filter });

		return handle;
	}

	function handlesOf<T extends Record<string, string[]>>(namespace: string, byProps: T) {
		return Object.fromEntries(
			Object.entries(byProps).map(([name, props]) => [
				name,
				lookup(filters.byProps(...props), `metro.${namespace}.${name}`, []),
			]),
		) as Record<keyof T, FakeModule>;
	}

	function onModuleLoaded(filter: FakeFilter, onLoad: (module: FakeModule) => void) {
		const found = first(filter);

		if (found) {
			onLoad(found);

			return () => void 0;
		}

		const wait: Wait = { filter, onLoad };

		waits.add(wait);

		return () => void waits.delete(wait);
	}

	const common = {
		...handlesOf('common', COMMON_PROPS),
		React,
		ReactNative: createFakeReactNative(),
	};

	return {
		stores: {},
		components: createFakeComponents(),
		api: handlesOf('api', API_PROPS),
		common,
		filters,
		find,
		findByProps: (...args) =>
			lookup(filters.byProps(...names(args)), `props ${names(args).join(', ')}`, args),
		findByName: (...args) =>
			lookup(filters.byName(names(args)[0]), `name ${names(args)[0]}`, args),
		findByFilePath: (...args) =>
			lookup(filters.byFilePath(names(args)[0]), `path ${names(args)[0]}`, args),
		getModulePresence(handle) {
			const lazy = typeof handle === 'object' && handle ? handles.get(handle) : undefined;

			if (!lazy) return;

			return lazy.resolve() ? 'loaded' : 'missing';
		},
		findLazy(filter, { signal } = {}) {
			const found = first(filter);

			if (found) {
				return found;
			}

			return new Promise((resolve) => {
				const wait: Wait = { filter, onLoad: resolve };

				waits.add(wait);
				signal?.addEventListener('abort', () => {
					waits.delete(wait);
					resolve(undefined);
				});
			});
		},
		onModuleLoaded,
		onModuleLoad(listener) {
			listeners.add(listener);

			return () => void listeners.delete(listener);
		},
		whenLoaded(target, onLoad) {
			const lazy = handles.get(target);

			if (!lazy) {
				onLoad(target);

				return () => void 0;
			}

			return onModuleLoaded(lazy.filter, onLoad);
		},
		reset() {
			modules.length = 0;
			paths.clear();
			waits.clear();
			listeners.clear();
		},
		register(module, path) {
			modules.push(module);

			if (path !== undefined) {
				paths.set(module, path);
			}

			for (const wait of waits) {
				if (wait.filter(module)) {
					waits.delete(wait);
					wait.onLoad(module);
				}
			}

			for (const listener of listeners) listener(module);
		},
	};
}
