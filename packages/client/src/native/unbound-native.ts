import type {
	UnboundAddonBundle,
	UnboundLoaderInfo,
	UnboundNativeBridge,
	UnboundNativeFonts,
	UnboundPluginBundle,
} from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';
import sha256 from '@unbound-app/utils/sha256';

const logger = createLogger('Native', 'UnboundNative');

function read<T>(method: keyof UnboundNativeBridge, call: (bridge: UnboundNativeBridge) => T) {
	const bridge = globalThis.UnboundNative;

	if (!bridge) return;

	try {
		return call(bridge);
	} catch (error) {
		logger.error(`Failed to read UnboundNative.${method}:`, error);
	}
}

/**
 * @description Reads the native loader's origin, version and the runtime's Hermes bytecode version.
 * @returns The loader info, or `undefined` when no loader installed `UnboundNative`.
 */
export function getLoader(): UnboundLoaderInfo | undefined {
	return read('getLoader', (bridge) => bridge.getLoader());
}

/**
 * @description Reads the installed plugins the loader scanned at launch.
 * @returns The plugins, empty when no loader installed `UnboundNative`.
 */
export function getPlugins(): UnboundPluginBundle[] {
	return read('getPlugins', (bridge) => bridge.getPlugins()) ?? [];
}

/**
 * @description Reads the installed themes the loader scanned at launch.
 * @returns The themes with their raw `bundle.json` text, empty when no loader installed `UnboundNative`.
 */
export function getThemes(): UnboundAddonBundle[] {
	return read('getThemes', (bridge) => bridge.getThemes()) ?? [];
}

/**
 * @description Has the loader rescan the installed addons, so native views see themes installed, updated or deleted since
 * launch. Does nothing on a loader from before `rescanAddons`.
 */
export function rescanAddons(): void {
	read('rescanAddons', (bridge) => bridge.rescanAddons?.());
}

/**
 * @description Reads the loader's font store bridge.
 * @returns `UnboundNative.fonts`, or `undefined` on a loader from before the font store.
 */
export function getNativeFonts(): UnboundNativeFonts | undefined {
	return globalThis.UnboundNative?.fonts;
}

/**
 * @description Hashes a string's UTF-8 bytes natively, or in JS when no loader installed `UnboundNative`.
 * @param text The string to hash.
 * @returns The SHA-256 digest as 64 lowercase hexadecimal characters.
 */
export function getSha256(text: string): string {
	return read('getSha256', (bridge) => bridge.getSha256(text)) ?? sha256(text);
}
