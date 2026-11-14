import type { NativePushState, NativeSerializableObject } from '@unbound-app/types';

import type { DebugInfo } from './format-debug-info';

type PushEnvironment = NonNullable<NonNullable<DebugInfo['push']>['environment']>;

const PERMISSIONS = new Set(['granted', 'denied', 'provisional', 'not asked']);

function environmentOf(entitlements?: NativeSerializableObject): PushEnvironment | undefined {
	if (!entitlements) {
		return undefined;
	}

	const value = entitlements['aps-environment'];

	return value === 'production' || value === 'development' ? value : 'missing';
}

/**
 * @description Combines the loader's notification facts with the push environment Discord is signed for.
 * @param push The loader's push facts, absent on older loaders.
 * @param entitlements Discord's entitlements on iOS.
 * @returns The push report, or `undefined` when the loader reports nothing.
 */
export function pushStateOf(
	push?: NativePushState,
	entitlements?: NativeSerializableObject,
): DebugInfo['push'] {
	if (!push || !PERMISSIONS.has(push.permission)) {
		return undefined;
	}

	return {
		permission: push.permission,
		registered: push.registered,
		playServices: push.playServices,
		environment: environmentOf(entitlements),
	};
}

export default pushStateOf;
