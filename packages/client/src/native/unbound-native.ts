import type {
	UnboundAddonBundle,
	UnboundFontFile,
	UnboundLoaderInfo,
	UnboundNativeBridge,
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
 * @description Reads the custom font files the loader registered.
 * @returns The fonts, empty when no loader installed `UnboundNative`.
 */
export function getFonts(): UnboundFontFile[] {
	return read('getFonts', (bridge) => bridge.getFonts()) ?? [];
}

/**
 * @description Reads the font names Discord can already use; the loader lists them on the first call.
 * @returns The font names, empty when no loader installed `UnboundNative`.
 */
export function getAvailableFonts(): string[] {
	return read('getAvailableFonts', (bridge) => bridge.getAvailableFonts()) ?? [];
}

/**
 * @description Hashes a string's UTF-8 bytes natively, or in JS when no loader installed `UnboundNative`.
 * @param text The string to hash.
 * @returns The SHA-256 digest as 64 lowercase hexadecimal characters.
 */
export function getSha256(text: string): string {
	return read('getSha256', (bridge) => bridge.getSha256(text)) ?? sha256(text);
}
