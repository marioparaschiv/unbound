import { useSyncExternalStore } from 'react';

function subscribeNever() {
	return () => undefined;
}

/**
 * @description Tells the server render from the browser one without an effect, so a portal waits for `document`.
 * @returns `true` in the browser, `false` while rendering on the server and hydrating.
 */
function useInBrowser(): boolean {
	return useSyncExternalStore(
		subscribeNever,
		() => true,
		() => false,
	);
}

export default useInBrowser;
