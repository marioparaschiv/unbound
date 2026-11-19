import type React from 'react';

type ReactModule = typeof React;
type MountedRef = { current: boolean };

function useMounted(react: ReactModule): MountedRef {
	const mounted = react.useRef(true);

	react.useEffect(() => {
		mounted.current = true;

		return () => {
			mounted.current = false;
		};
	}, []);

	return mounted;
}

function useGuarded<A extends unknown[]>(
	react: ReactModule,
	update: (...args: A) => void,
	mounted: MountedRef,
	report: () => void,
): (...args: A) => void {
	return react.useCallback(
		(...args: A) => {
			if (!mounted.current) {
				report();
			}

			update(...args);
		},
		[update],
	);
}

/**
 * @description Gives a plugin a React whose `useState` and `useReducer` report updates sent to a component after it
 * unmounted. React drops those silently, but each one means something the plugin started there, such as a timer,
 * listener or request, still runs.
 * @template T The React module, or a scoped copy of it.
 * @param react The React the plugin would get.
 * @param report Called for each update a component receives after it unmounted.
 * @returns A React that behaves the same, with the two hooks wrapped.
 */
export function guardUnmountedUpdates<T extends ReactModule>(react: T, report: () => void): T {
	function useState<S>(initial: S | (() => S)) {
		const [state, setState] = react.useState(initial);
		const mounted = useMounted(react);

		return [state, useGuarded(react, setState, mounted, report)] as const;
	}

	function useReducer(...args: Parameters<ReactModule['useReducer']>) {
		const [state, dispatch] = react.useReducer(...args);
		const mounted = useMounted(react);

		return [state, useGuarded(react, dispatch, mounted, report)] as const;
	}

	return Object.defineProperties(Object.create(react) as T, {
		useState: { value: useState, enumerable: true },
		useReducer: { value: useReducer, enumerable: true },
	});
}

/**
 * @description Builds the reporter for one plugin: it logs the first update after unmount the plugin sends, with the stack
 * that sent it, and stays quiet after that.
 * @param name The plugin's name.
 * @param warn Writes the warning.
 * @returns The reporter for {@link guardUnmountedUpdates}.
 */
export function reportUnmountedUpdatesOnce(
	name: string,
	warn: (message: string, stack: string | undefined) => void,
): () => void {
	let reported = false;

	return () => {
		if (reported) return;

		reported = true;
		warn(
			`${name} updated a component after it unmounted: something it started there, such as a timer, listener or request, still runs. Stop it in the effect's cleanup.`,
			new Error('update after unmount').stack,
		);
	};
}
