import type { ComponentType } from 'react';
import { AppRegistry } from 'react-native';
import { metro } from '@unbound-app/api';

import { nextSurfaceName } from './surface-name';

type Registry = Pick<typeof AppRegistry, 'registerComponent'> &
	Partial<Pick<typeof AppRegistry, 'getAppKeys'>>;

type RegistryGlobal = typeof globalThis & {
	RN$AppRegistry?: Registry;
};

function findRegistry(): Registry | undefined {
	return (
		AppRegistry ??
		(globalThis as RegistryGlobal).RN$AppRegistry ??
		(metro.findByProps('registerComponent', 'runApplication') as Registry | undefined)
	);
}

/**
 * @description Registers a root component that Fabric can mount into a native view. App keys cannot be unregistered, so each call takes the next free name.
 * @param prefix The surface's name prefix, such as `MessageLinkEmbedSurface`.
 * @param component The root component.
 * @returns The registered name to pass to `fabric.mount`, or `undefined` when React Native refused it.
 */
export function registerAppSurface<P extends object>(
	prefix: string,
	component: ComponentType<P>,
): string | undefined {
	const registry = findRegistry();

	if (typeof registry?.registerComponent !== 'function') return;

	const name = nextSurfaceName(prefix, registry.getAppKeys?.() ?? []);

	try {
		registry.registerComponent(name, () => component);

		return name;
	} catch {
		return;
	}
}

export default registerAppSurface;
