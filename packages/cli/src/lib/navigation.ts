// Each function here runs on the device through `toDeviceCode`, so none may reach outside its own body.
import type { UnboundGlobal } from '@unbound-app/api/global';

/** Route parameters passed to a settings screen, as JSON. */
export type ScreenParams = Record<string, string | number | boolean | null>;

/** A route on Discord's React Navigation stack, with the nested stack it hosts. */
type Route = { name: string; params?: ScreenParams; state?: NavigationState };

type NavigationState = { index?: number; routes: Route[] };

/** What the device reports for `ubd mcp route`. */
export type CurrentRoute = { name: string; params: ScreenParams; path: string[] };

/**
 * @description Opens a settings screen from anywhere in the app, through Discord's root navigation ref.
 * @param unbound Unbound's global on the device.
 * @param name A route key, or a name matching one ignoring case, underscores and `UNBOUND_` (`Marketplace` → `UNBOUND_MARKETPLACE`).
 * @param params Route parameters for the screen.
 * @returns The route key it opened. Throws, listing Unbound's screens, when nothing matches.
 */
export function openScreen(unbound: UnboundGlobal, name: string, params: ScreenParams): string {
	const { SETTING_RENDERER_CONFIG } = unbound.metro.findByProps('SETTING_RENDERER_CONFIG');
	const { getRootNavigationRef } = unbound.metro.findByProps('getRootNavigationRef');

	function normalize(key: string) {
		return key
			.toLowerCase()
			.replace(/^unbound_/, '')
			.replace(/[^a-z0-9]/g, '');
	}

	const keys = Object.keys(SETTING_RENDERER_CONFIG);
	const own = keys.filter((key) => key.startsWith('UNBOUND_'));
	const wanted = normalize(name);
	const route = keys.includes(name)
		? name
		: (own.find((key) => normalize(key) === wanted) ??
			keys.find((key) => normalize(key) === wanted));

	if (!route) {
		throw new Error(`No settings screen matches ${name}. Unbound screens: ${own.join(', ')}`);
	}

	getRootNavigationRef().navigate('settings', { screen: route, params });

	return route;
}

/**
 * @description Reads the focused route and the stack of route names leading to it.
 * @param unbound Unbound's global on the device.
 * @returns The route as a JSON string of {@link CurrentRoute}.
 */
export function currentRoute(unbound: UnboundGlobal): string {
	const ref = unbound.metro.findByProps('getRootNavigationRef').getRootNavigationRef();
	const path: string[] = [];
	let state: NavigationState | undefined = ref.getRootState();

	while (state) {
		const route = state.routes[state.index ?? state.routes.length - 1];

		if (!route) {
			break;
		}

		path.push(route.name);
		state = route.state;
	}

	const { name, params }: Route = ref.getCurrentRoute();
	const result: CurrentRoute = { name, params: params ?? {}, path };

	return JSON.stringify(result);
}

export default { openScreen, currentRoute };
