import type {
	UnboundAddonBundle,
	UnboundAppIcon,
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
 * @description Reads the app icons declared by the installed loader.
 * @returns The icons, or an empty list when the loader provides none.
 */
export function getAppIcons(): UnboundAppIcon[] {
	return read('getAppIcons', (bridge) => bridge.getAppIcons?.()) ?? [];
}

/**
 * @description Reports whether the installed loader can add or remove custom app icons.
 * @returns Whether `syncAppIcons` is available.
 */
export function canSyncAppIcons(): boolean {
	return typeof globalThis.UnboundNative?.syncAppIcons === 'function';
}

/**
 * @description Asks the loader to install saved custom app icons and remove deleted ones.
 */
export function syncAppIcons(): void {
	read('syncAppIcons', (bridge) => bridge.syncAppIcons?.());
}

/**
 * @description Reports whether the loader can add a Home Screen shortcut with a custom icon, which jailed iOS uses
 * in place of real alternate icons.
 * @returns Whether `installHomeScreenIcon` is available.
 */
export function canInstallHomeScreenIcon(): boolean {
	return typeof globalThis.UnboundNative?.installHomeScreenIcon === 'function';
}

/**
 * @description Asks the loader to offer a Home Screen shortcut to Discord with an image: a profile on iOS, a pinned shortcut on Android.
 * @param name The shortcut's label.
 * @param imagePath The image's absolute path inside Unbound's AppIcons folder.
 * @returns Whether the profile was prepared and opened.
 */
export function installHomeScreenIcon(name: string, imagePath: string): boolean {
	return (
		read('installHomeScreenIcon', (bridge) =>
			bridge.installHomeScreenIcon?.(name, imagePath),
		) ?? false
	);
}

/**
 * @description Reports whether a newer client bundle downloaded during this launch and runs after a restart.
 * @returns Whether a staged bundle waits, `false` on a loader from before it.
 */
export function hasStagedBundle(): boolean {
	return read('hasStagedBundle', (bridge) => bridge.hasStagedBundle?.()) ?? false;
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
 * @description Has the loader reread the installed themes, so native views see ones installed, updated or deleted since
 * launch. Does nothing on a loader from before `rescanThemes`.
 */
export function rescanThemes(): void {
	read('rescanThemes', (bridge) => bridge.rescanThemes?.());
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
