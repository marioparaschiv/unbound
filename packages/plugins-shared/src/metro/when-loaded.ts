import type { MetroFilter, MetroLazySearchOptions } from '@unbound-app/api/metro';
import { metro } from '@unbound-app/api';

type Cleanup = () => void;

/** A metro filter, or a module's source file path such as `modules/chat/native/TypingIndicator.tsx`. */
export type ModuleSource = MetroFilter | string;

export type WhenLoadedOptions = Omit<MetroLazySearchOptions, 'signal'>;

function toFilter(source: ModuleSource): MetroFilter {
	return typeof source === 'string' ? metro.filters.byFilePath(source) : source;
}

function findFirst<T>(
	sources: ModuleSource[],
	options: WhenLoadedOptions,
	signal: AbortSignal,
): T | Promise<T | undefined> {
	const waits: Promise<T | undefined>[] = [];

	for (const source of sources) {
		const found = metro.findLazy(toFilter(source), { ...options, signal });

		if (!(found instanceof Promise)) {
			return found;
		}

		waits.push(found);
	}

	return Promise.race(waits);
}

/**
 * @description Applies a feature to a module once it loads, now or later, so `stop` can cancel the wait or remove the feature.
 * @template T The module's type.
 * @param source The module's filter or file path, or several in order of preference: the first loaded wins, else the first to load.
 * @param apply Applies the feature and returns the function that removes it, or nothing when it did not apply.
 * @param options Metro search options, such as `interop`; a file path always yields the module's exports.
 * @returns A function that stops waiting and removes the feature if it was applied; call it in `stop`.
 */
export function whenLoaded<T extends object>(
	source: ModuleSource | ModuleSource[],
	apply: (module: T) => Cleanup | void,
	options: WhenLoadedOptions = {},
): Cleanup {
	const controller = new AbortController();
	const sources = Array.isArray(source) ? source : [source];
	let remove: Cleanup | void;

	void Promise.resolve(findFirst<T>(sources, options, controller.signal)).then((module) => {
		if (controller.signal.aborted) return;

		// Ends the waits on the other sources.
		controller.abort();

		if (module) {
			remove = apply(module);
		}
	});

	return () => {
		controller.abort();
		remove?.();
		remove = undefined;
	};
}

/**
 * @description Applies a feature once every module it needs has loaded, now or later, for features that read their modules through lazy handles.
 * @param sources One entry per module, each a filter, a file path, or candidates as `whenLoaded` takes them.
 * @param apply Applies the feature and returns the function that removes it, or nothing when it did not apply.
 * @returns A function that stops waiting and removes the feature if it was applied; call it in `stop`.
 */
export function whenAllLoaded(
	sources: (ModuleSource | ModuleSource[])[],
	apply: () => Cleanup | void,
): Cleanup {
	const [first, ...rest] = sources;

	if (!first) {
		const remove = apply();

		return () => remove?.();
	}

	return whenLoaded(first, () => whenAllLoaded(rest, apply));
}

export default { whenLoaded, whenAllLoaded };
