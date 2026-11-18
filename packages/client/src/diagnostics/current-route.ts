type Route = { name?: string; state?: NavigationState };

type NavigationState = { index?: number; routes?: Route[] };

type NavigationRef = { getRootState?: () => NavigationState | undefined };

type NavigationModule = { getRootNavigationRef?: () => NavigationRef | undefined };

const MAXIMUM_DEPTH = 8;

/**
 * @description Names the screens leading to the focused one, from a navigation state, without their params.
 * @param state The root navigation state.
 * @returns The route names joined with ` > `, or `undefined` when no route is focused.
 */
export function focusedRoutePath(state: NavigationState | undefined): string | undefined {
	const names: string[] = [];
	let current = state;

	while (current?.routes?.length && names.length < MAXIMUM_DEPTH) {
		const route = current.routes[current.index ?? current.routes.length - 1];

		if (!route?.name) {
			break;
		}

		names.push(route.name);
		current = route.state;
	}

	return names.length ? names.join(' > ') : undefined;
}

/**
 * @description Reads which screen Discord shows, for a crash report.
 * @returns The focused route path, or `undefined` when Discord's navigation can't be read.
 */
export async function currentRoutePath(): Promise<string | undefined> {
	try {
		const { findByProps } = await import('~/metro/lookups');
		const navigation = findByProps('getRootNavigationRef') as NavigationModule | undefined;

		return focusedRoutePath(navigation?.getRootNavigationRef?.()?.getRootState?.());
	} catch {
		return undefined;
	}
}
