import { useReducer } from 'react';


function useForceUpdate() {
	const [, forceUpdate] = useReducer(n => n + 1, 0);

	return forceUpdate;
}

export default useForceUpdate;