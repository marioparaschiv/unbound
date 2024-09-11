import type { Store } from '@typings/discord/flux';
import type { DependencyList } from 'react';

export interface FluxHooks {
	useStateFromStores: <T>(
		stores: Store[],
		callback: () => T,
		deps?: DependencyList,
		compare?:
			| (<T extends []>(a: T, b: T) => boolean)
			| (<T extends Record<string, unknown>>(a: T, b: T) => boolean),
	) => T;
	statesWillNeverBeEqual: <T>(a: T, b: T) => boolean;
	useStateFromStoresArray: <T>(
		stores: Store[],
		callback: () => T,
		deps?: DependencyList,
	) => T;
	useStateFromStoresObject: <T>(
		stores: Store[],
		callback: () => T,
		deps?: DependencyList,
	) => T;
}

export type EqualityComparer = (a: unknown[], b: unknown[]) => boolean;