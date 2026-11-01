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

type Wait = {
	filter: FakeFilter;
	onLoad: (module: FakeModule) => void;
};

/** A metro over modules a test registers, with the finders and filters plugins call. */
export type FakeMetro = {
	/** Adds a module, settling any `findLazy` or `onModuleLoaded` waiting for it and calling `onModuleLoad` listeners. */
	register: (module: FakeModule, path?: string) => void;
	stores: Record<string, FakeModule>;
	filters: {
		byProps: (...props: string[]) => FakeFilter;
		byName: (name: string) => FakeFilter;
		byFilePath: (path: string) => FakeFilter;
	};
	find: (filter: FakeFilter) => FakeModule | undefined;
	findByProps: (...args: (string | FindOptions)[]) => FakeModule | undefined;
	findByName: (...args: (string | FindOptions)[]) => FakeModule | undefined;
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

	function find(filter: FakeFilter) {
		return modules.find((module) => filter(module));
	}

	return {
		stores: {},
		filters,
		find,
		findByProps: (...args) => find(filters.byProps(...names(args))),
		findByName: (...args) => find(filters.byName(names(args)[0])),
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
