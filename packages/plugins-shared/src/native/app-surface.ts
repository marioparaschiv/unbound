import type { ComponentType } from 'react';
import { AppRegistry } from 'react-native';
import { metro } from '@unbound-app/api';
import { createElement } from 'react';

import { nextSurfaceName } from './surface-name';

type Registry = Pick<typeof AppRegistry, 'registerComponent'> &
	Partial<Pick<typeof AppRegistry, 'getAppKeys'>>;

type SurfaceComponent = ComponentType<object>;

type SurfaceHolder = { name: string; current?: SurfaceComponent };

type SurfaceGlobal = typeof globalThis & {
	RN$AppRegistry?: Registry;
	__unboundAppSurfaces?: Record<string, SurfaceHolder>;
};

type ProviderFactory = (
	holder: SurfaceHolder,
	render: typeof createElement,
) => () => SurfaceComponent;

const createProvider = new Function(
	'holder',
	'render',
	'var surface = function UnboundAppSurface(props) { var component = holder.current; return component ? render(component, props) : null; }; return function () { return surface; };',
) as ProviderFactory;

function findRegistry(): Registry | undefined {
	return (
		AppRegistry ??
		(globalThis as SurfaceGlobal).RN$AppRegistry ??
		(metro.findByProps('registerComponent', 'runApplication') as Registry | undefined)
	);
}

function surfaceHolders(): Record<string, SurfaceHolder> {
	const scope = globalThis as SurfaceGlobal;

	scope.__unboundAppSurfaces ??= {};

	return scope.__unboundAppSurfaces;
}

/**
 * @description Registers a root component that Fabric can mount into a native view. App keys cannot be unregistered, so each prefix is registered once and later calls swap in the new component; the registered root keeps no reference to the plugin bundle that called it, so a restarted plugin's old bundle can be collected.
 * @param prefix The surface's name prefix, such as `MessageLinkEmbedSurface`.
 * @param component The root component.
 * @returns The registered name to pass to `fabric.mount`, or `undefined` when React Native refused it.
 */
export function registerAppSurface<P extends object>(
	prefix: string,
	component: ComponentType<P>,
): string | undefined {
	const holders = surfaceHolders();
	const existing = holders[prefix];

	if (existing) {
		existing.current = component as SurfaceComponent;

		return existing.name;
	}

	const registry = findRegistry();

	if (typeof registry?.registerComponent !== 'function') return;

	const holder: SurfaceHolder = {
		name: nextSurfaceName(prefix, registry.getAppKeys?.() ?? []),
		current: component as SurfaceComponent,
	};

	try {
		registry.registerComponent(holder.name, createProvider(holder, createElement));
		holders[prefix] = holder;

		return holder.name;
	} catch {
		return;
	}
}

export default registerAppSurface;
