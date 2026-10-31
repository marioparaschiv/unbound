import type { AnyObject } from '../src/patcher';

/** What `createElement` returns: the element's type and its props with `children`. */
export type FakeElement = {
	type: string | ((props: FakeProps) => FakeElement | null);
	props: FakeProps;
};

type FakeProps = AnyObject & {
	children?: FakeChild[];
};

type Ref<T> = {
	current: T;
};

type FakeChild = FakeElement | string | number | boolean | null | undefined;

type SetState<T> = (next: T | ((previous: T) => T)) => void;

/** A React without a renderer: elements are plain objects and hooks run once, as on a first render. */
export type FakeReact = {
	Fragment: string;
	createElement: (
		type: FakeElement['type'],
		props?: FakeProps | null,
		...children: FakeChild[]
	) => FakeElement;
	useState: <T>(initial: T | (() => T)) => [T, SetState<T>];
	useMemo: <T>(factory: () => T) => T;
	useCallback: <T>(callback: T) => T;
	useRef: <T>(initial: T) => Ref<T>;
	useEffect: (effect: () => void | (() => void)) => void;
};

/**
 * @description Creates a React whose elements are plain objects, for tests that call components without rendering them.
 * @returns The fake React.
 */
export function createFakeReact(): FakeReact {
	return {
		Fragment: 'Fragment',
		createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
		useState<T>(initial: T | (() => T)): [T, SetState<T>] {
			const value = initial instanceof Function ? initial() : initial;

			return [value, () => {}];
		},
		useMemo: (factory) => factory(),
		useCallback: (callback) => callback,
		useRef: (initial) => ({ current: initial }),
		useEffect: () => {},
	};
}
