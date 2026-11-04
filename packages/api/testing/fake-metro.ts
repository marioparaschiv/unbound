import type { AnyObject } from '../src/patcher';

/** A module the fake metro serves: the exports a plugin finds. */
export type FakeModule = AnyObject;

/** A fake metro filter. `path` marks a file-path filter, which matches the path a module was registered under. */
export type FakeFilter = ((module: FakeModule) => boolean) & { path?: string };

type LazyOptions = {
	signal?: AbortSignal;
};

type FindOptions = {
	lazy?: boolean;
};

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

type Wait = {
	filter: FakeFilter;
	onLoad: (module: FakeModule) => void;
};

/** A metro over modules a test registers, with the finders and filters plugins call. */
export type FakeMetro = {
	/** Adds a module, settling any `findLazy` or `onModuleLoaded` waiting for it and calling `onModuleLoad` listeners. */
	register: (module: FakeModule, path?: string) => void;
	stores: Record<string, FakeModule>;
	/** Discord's common modules, each a lazy handle found by the same props as on device, such as `Theme`. */
	common: Record<keyof typeof COMMON_PROPS, FakeModule>;
	filters: {
		byProps: (...props: string[]) => FakeFilter;
		byName: (name: string) => FakeFilter;
		byFilePath: (path: string) => FakeFilter;
	};
	find: (filter: FakeFilter) => FakeModule | undefined;
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
	onModuleLoad: (listener: (module: FakeModule) => void) => () => void;
};

function names(args: (string | FindOptions)[]): string[] {
	return args.filter((arg) => typeof arg === 'string');
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
		byFilePath: (path) =>
			Object.assign((module: FakeModule) => paths.get(module) === path, { path }),
	};

	const handles = new WeakMap<FakeModule, () => FakeModule | undefined>();

	function find(filter: FakeFilter) {
		return modules.find((module) => filter(module));
	}

	function lookup(filter: FakeFilter, description: string, eager = false) {
		if (eager) {
			return find(filter);
		}

		const resolve = () => find(filter);
		const handle = lazyHandle(resolve, description);

		handles.set(handle, resolve);

		return handle;
	}

	const common = Object.fromEntries(
		Object.entries(COMMON_PROPS).map(([name, props]) => [
			name,
			lookup(filters.byProps(...props), `metro.common.${name}`),
		]),
	) as FakeMetro['common'];

	return {
		stores: {},
		common,
		filters,
		find,
		findByProps: (...args) =>
			lookup(
				filters.byProps(...names(args)),
				`props ${names(args).join(', ')}`,
				isEager(args),
			),
		findByName: (...args) =>
			lookup(filters.byName(names(args)[0]), `name ${names(args)[0]}`, isEager(args)),
		findByFilePath: (...args) =>
			lookup(filters.byFilePath(names(args)[0]), `path ${names(args)[0]}`, isEager(args)),
		getModulePresence(handle) {
			const resolve = typeof handle === 'object' && handle ? handles.get(handle) : undefined;

			if (!resolve) return;

			return resolve() ? 'loaded' : 'missing';
		},
		findLazy(filter, { signal } = {}) {
			const found = find(filter);

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
		onModuleLoaded(filter, onLoad) {
			const found = find(filter);

			if (found) {
				onLoad(found);

				return () => void 0;
			}

			const wait: Wait = { filter, onLoad };

			waits.add(wait);

			return () => void waits.delete(wait);
		},
		onModuleLoad(listener) {
			listeners.add(listener);

			return () => void listeners.delete(listener);
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
