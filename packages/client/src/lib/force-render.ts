import type { JSX } from 'react';
import * as React from 'react';

const overrides = {
	useMemo: (factory: () => unknown) => factory(),
	useState: <T>(state: T) => [state, () => void 0] as const,
	useReducer: <T>(state: T) => [state, () => void 0] as const,
	useEffect: () => void 0,
	useInsertionEffect: () => void 0,
	useDeferredValue: <T>(value: T) => value,
	useLayoutEffect: () => void 0,
	useRef: () => ({ current: null }),
	useCallback: <T>(callback: T) => callback,
	useImperativeHandle: () => void 0,
	useTransition: () => [false, () => void 0] as const,
	useSyncExternalStore: <T>(_: unknown, getSnapshot: () => T) => getSnapshot(),
	useContext: <T>(context: Context<T>) => context._currentValue,
};

type Component<T extends unknown[]> = (...args: T) => JSX.Element;
type Context<T> = { _currentValue: T };
type Dispatcher = Record<string, unknown>;
type ReactInternals = {
	H: Dispatcher;
};
type ReactWithInternals = typeof React & {
	__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactInternals;
};

/**
 * @description Fakes React's hook dispatcher to invoke a function component and inspect its returned element tree.
 * @template T The props arguments accepted by the component.
 * @param component The function component to invoke.
 * @param context Optional `this` value for the component.
 * @returns A function that invokes the component with hooks replaced by static values.
 */
function forceRender<T extends unknown[]>(
	component: Component<T>,
	context?: unknown,
): (...args: T) => JSX.Element {
	return (...args) => {
		const dispatcher = (React as ReactWithInternals)
			.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H;
		const originals = Object.fromEntries(
			Object.keys(overrides).map((key) => [key, dispatcher[key]]),
		);

		Object.assign(dispatcher, overrides);

		try {
			return context ? component.call(context, ...args) : component(...args);
		} finally {
			Object.assign(dispatcher, originals);
		}
	};
}

export default forceRender;
