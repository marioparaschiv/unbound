import type { MetroFilter, MetroModuleLoadedOptions } from '@unbound-app/api/metro';
import { metro } from '@unbound-app/api';

type Cleanup = () => void;

/** A metro filter, or a module's source file path such as `modules/chat/native/TypingIndicator.tsx`. */
export type ModuleSource = MetroFilter | string;

export type WhenLoadedOptions = MetroModuleLoadedOptions;

function toFilter(source: ModuleSource): MetroFilter {
	return typeof source === 'string' ? metro.filters.byFilePath(source) : source;
}

/**
 * @description Applies a feature to a module once it loads, without loading it, so `stop` can cancel the wait or remove the feature.
 * A loaded module gets the feature at once; otherwise it is applied while the module initializes, before Discord reads it.
 * @template T The module's type.
 * @param source The module's filter or file path, or several in order of preference: the first loaded wins, else the first to load.
 * @param apply Applies the feature and returns the function that removes it, or nothing when it did not apply.
 * @param options Metro wait options, such as `interop`; a file path always yields the module's exports.
 * @returns A function that stops waiting and removes the feature if it was applied; call it in `stop`.
 */
export function whenLoaded<T extends object>(
	source: ModuleSource | ModuleSource[],
	apply: (module: T) => Cleanup | void,
	options: WhenLoadedOptions = {},
): Cleanup {
	const sources = Array.isArray(source) ? source : [source];
	const waits: Cleanup[] = [];
	let loaded = false;
	let remove: Cleanup | void;

	function stopWaiting() {
		for (const stop of waits) stop();
	}

	function load(module: T) {
		if (loaded) return;

		loaded = true;
		stopWaiting();
		remove = apply(module);
	}

	for (const candidate of sources) {
		if (loaded) {
			break;
		}

		waits.push(metro.onModuleLoaded(toFilter(candidate), load, options));
	}

	return () => {
		stopWaiting();
		remove?.();
		remove = undefined;
	};
}

/**
 * @description Applies a feature once every module it needs has loaded, without loading any, for features that read their modules through lazy handles.
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
