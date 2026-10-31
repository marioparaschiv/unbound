declare module 'react-refresh/runtime' {
	import type { FunctionComponent } from 'react';

	/** A component or a `memo` / `forwardRef` object, as registered by the refresh transform. */
	export type RefreshType = FunctionComponent<never> | { $$typeof: symbol };

	/** Every version of one component across module re-runs; `current` is the latest. */
	export type Family = { current: RefreshType };

	export type RefreshUpdate = {
		updatedFamilies: Set<Family>;
		staleFamilies: Set<Family>;
	};

	export function register(type: RefreshType, id: string): void;
	export function createSignatureFunctionForTransform(): <T>(type: T, key?: string) => T;
	export function performReactRefresh(): RefreshUpdate | null;
	export function getFamilyByID(id: string): Family | undefined;
	export function getFamilyByType(type: RefreshType): Family | undefined;
}
