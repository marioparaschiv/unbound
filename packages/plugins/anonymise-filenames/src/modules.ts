import { metro, storage } from '@unbound-app/api';

import { readSettings } from '~/filenames';

export const { Messages } = metro.api;
export const CloudUploaderFilter = metro.filters.byProps('CloudUpload');

export const settings = storage.getBucket();

/**
 * @description Reads the plugin's current settings, normalised.
 * @returns The settings to rename uploads with.
 */
export function currentSettings() {
	return readSettings((key, fallback) => settings.get(key, fallback));
}
