import type { ComponentType, ReactElement } from 'react';
import type { AppRegistry } from 'react-native';

const SURFACE_KEY = /^([A-Z][A-Za-z]*Surface)\d+$/;

/** The props React Native gives a surface's root component. */
export type SurfaceProps = { surfaceId?: number; rootTag?: number };

type SurfaceComponent = ComponentType<SurfaceProps>;

/** A plugin surface's registered app key and the component its plugin last gave it. */
export type SurfaceHolder = { name: string; current?: SurfaceComponent };

/** The registry calls a restarted surface reaches. */
export type SurfaceRegistry = Pick<typeof AppRegistry, 'registerComponent' | 'getAppKeys'>;

/** Creates the element for a plugin's surface component. */
export type SurfaceRender = (component: SurfaceComponent, props: SurfaceProps) => ReactElement;

type SurfaceGlobal = typeof globalThis & { __unboundAppSurfaces?: Record<string, SurfaceHolder> };

/**
 * @description Finds the prefix of an app key that plugins register for native surfaces, such as
 * `ReactionAvatarSurface` in `ReactionAvatarSurface0`.
 * @param key The app key React Native was asked to run.
 * @returns The prefix, or `undefined` when the key is not a plugin surface's.
 */
export function surfacePrefix(key: string): string | undefined {
	return SURFACE_KEY.exec(key)?.[1];
}

function holders(): Record<string, SurfaceHolder> {
	const scope = globalThis as SurfaceGlobal;

	scope.__unboundAppSurfaces ??= {};

	return scope.__unboundAppSurfaces;
}

/**
 * @description Registers a plugin surface's app key that React Native restarted before its plugin started, so the
 * surface renders nothing instead of failing, then draws the plugin's component once the plugin registers it again.
 * @param registry React Native's app registry.
 * @param key The app key React Native is about to run.
 * @param render Creates the element for the plugin's component.
 * @returns Whether the key was adopted.
 */
export function adoptRestartedSurface(
	registry: SurfaceRegistry,
	key: string,
	render: SurfaceRender,
): boolean {
	const prefix = surfacePrefix(key);

	if (!prefix || registry.getAppKeys().includes(key)) {
		return false;
	}

	const existing = holders()[prefix];
	const holder = existing?.name === key ? existing : { name: key };

	function UnboundRestartedSurface(props: SurfaceProps) {
		return holder.current ? render(holder.current, props) : null;
	}

	registry.registerComponent(key, () => UnboundRestartedSurface);
	holders()[prefix] ??= holder;

	return true;
}

export default { surfacePrefix, adoptRestartedSurface };
