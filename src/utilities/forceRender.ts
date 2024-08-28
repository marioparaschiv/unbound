const overrides = {
	useMemo: factory => factory(),
	useState: s => [s, () => void 0],
	useReducer: v => [v, () => void 0],
	useEffect: () => { },
	useInsertionEffect: () => { },
	useDeferredValue: () => { },
	useLayoutEffect: () => { },
	useRef: () => ({ current: null }),
	useCallback: cb => cb,
	useImperativeHandle: () => { },
	useTransition: () => [false, () => void 0],
	useSyncExternalStore: (_, snapshot) => snapshot(),
	useContext: (ctx) => ctx._currentValue
};

const keys = Object.keys(overrides);

/**
 * @description Allows you to fake render a component to get its return value. This also supports props.
 * @param component The React function component to call. (Note: For class components, please use <Component>.prototype.render for this value)
 * @param context The component you are passing might use the "this" keyword. This argument will be the value provided when "this" is used inside the component. (Optional)
 * @returns A callable function to get the components return value using the props provided. (e.g. func({ count: 1 }))
 */
function forceRender<T extends (...args: any[]) => JSX.Element>(component: T, context?: any): (...args: Parameters<T>) => (...args: any[]) => ReturnType<T> {
	return (...args) => {
		const ReactDispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
		const originals = keys.map(e => [e, ReactDispatcher[e]]);

		Object.assign(ReactDispatcher, overrides);

		const res = {
			rendered: null,
			error: null
		};

		try {
			res.rendered = context ? component.call(context, args) : component(...args);
		} catch (error) {
			res.error = error;
		}

		Object.assign(ReactDispatcher, Object.fromEntries(originals));

		if (res.error) {
			throw res.error;
		}

		return res.rendered;
	};
};

export default forceRender;