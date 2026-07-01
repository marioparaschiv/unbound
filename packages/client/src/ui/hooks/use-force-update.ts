import { useReducer } from 'react';

/**
 * @description Returns a stable callback that forces the calling component to re-render.
 * @returns A function that triggers a re-render when called.
 */
function useForceUpdate(): () => void {
	const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
	return forceUpdate;
}

export default useForceUpdate;
