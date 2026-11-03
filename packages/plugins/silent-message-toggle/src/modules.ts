import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { flux, metro, storage } from '@unbound-app/api';

import { sharedSilentToggle } from '~/silent';
import { SETTINGS, type SettingKey } from '~/constants';

export const Messages = metro.api.Messages;
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });
export const Haptics = metro.findByFilePath('modules/haptics/HapticUtils.native.tsx', {
	lazy: true,
});

export const settings = storage.getBucket('unbound.silent-message-toggle');

export const SilentToggle = sharedSilentToggle('unbound.silent-message-toggle');
export const ToggleRunning = createRunningFlag('unbound.silent-message-toggle');

/**
 * @description Reads one of the plugin's switches with its default.
 * @param key The setting to read.
 * @returns The stored value, or the default when none is stored.
 */
export function readSetting(key: SettingKey): boolean {
	return settings.get(key, SETTINGS[key]);
}
