import { createLogger } from '@unbound-app/logger';

const logger = createLogger('Plugins', 'Temp');

/**
 * @description Names a plugin's temporary folder, relative to the documents directory.
 * @param id The plugin's id.
 * @returns The folder path, inside the Unbound folder so the loader may remove it.
 */
export function pluginTempPath(id: string): string {
	return `Unbound/Temp/${id}`;
}

/**
 * @description Removes a plugin's temporary folder and everything in it.
 * @param id The plugin's id.
 */
export function clearPluginTemp(id: string): void {
	try {
		globalThis.NativePlatform?.files?.remove(`Temp/${id}`);
	} catch (error) {
		logger.warn(`Failed to clear the temporary folder of ${id}:`, error);
	}
}
