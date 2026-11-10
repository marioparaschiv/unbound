import { flux, metro, storage } from '@unbound-app/api';

import type { NotificationUpdate } from '~/apply/payloads';

type NotificationSettingsActions = {
	updateGuildNotificationSettings?: (guildId: string, update: NotificationUpdate) => unknown;
};

type OptInChannelsActions = {
	toggleShowAllChannels?: (guildId: string) => unknown;
};

type UserGuildSettings = {
	isOptInEnabled?: (guildId: string) => boolean;
};

export const NotificationSettings: NotificationSettingsActions = metro.findByProps(
	'updateGuildNotificationSettings',
);

export const OptInChannels: OptInChannelsActions = metro.findByProps('toggleShowAllChannels');

export const UserGuildSettingsStore = flux.getStore('UserGuildSettings') as ReturnType<
	typeof flux.getStore
> &
	UserGuildSettings;

export const settings = storage.getBucket(addon.id);
