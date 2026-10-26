import type { NativeCrashedAddon, NativePlatformCrashGuard } from '@unbound-app/types/native';

let disabledAfterCrash: Map<string, NativeCrashedAddon> | undefined;

function bridge(): NativePlatformCrashGuard | undefined {
	return globalThis.NativePlatform?.crashGuard;
}

/**
 * @description Records natively that an addon is starting, so a crash during its start survives into the next launch.
 * @param key The addon's crash guard key.
 * @param name The addon's display name.
 */
export function beginAddonStart(key: string, name: string): void {
	bridge()?.begin(key, name);
}

/**
 * @description Clears the native start marker once an addon's start has returned.
 * @param key The addon's crash guard key.
 */
export function finishAddonStart(key: string): void {
	bridge()?.end(key);
}

/**
 * @description Looks up whether the loader disabled an addon because Discord crashed while starting it on consecutive launches.
 * @param key The addon's crash guard key.
 * @returns The crashed addon reported by the loader, or `undefined`.
 */
export function crashedAddon(key: string): NativeCrashedAddon | undefined {
	disabledAfterCrash ??= new Map((bridge()?.disabled() ?? []).map((addon) => [addon.id, addon]));

	return disabledAfterCrash.get(key);
}

/**
 * @description Forgets the cached loader verdict so the next lookup asks the bridge again.
 */
export function resetCrashGuard(): void {
	disabledAfterCrash = undefined;
}
