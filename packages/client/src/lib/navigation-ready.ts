import { findByPropsLazy } from '~/api/metro/wrappers';

type NavigationRef = {
	isReady: () => boolean;
	navigate: <Params>(route: string, params?: Params) => void;
};

const Navigation = findByPropsLazy('getRootNavigationRef');

const NAVIGATION_TIMEOUT_MS = 30_000;
const NAVIGATION_POLL_MS = 100;

/**
 * @description Waits until Discord's root navigator can navigate, as it cannot while a link launches the app.
 * @returns The root navigation ref.
 */
export async function navigationReady(): Promise<NavigationRef> {
	const ref: NavigationRef = Navigation.getRootNavigationRef();

	for (let waited = 0; !ref.isReady(); waited += NAVIGATION_POLL_MS) {
		if (waited >= NAVIGATION_TIMEOUT_MS) {
			throw new Error('Discord navigation never became ready.');
		}

		await new Promise((resolve) => setTimeout(resolve, NAVIGATION_POLL_MS));
	}

	return ref;
}

export default navigationReady;
