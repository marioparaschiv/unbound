import { flux, metro } from '@unbound-app/api';

import type { NotificationUpdate } from '~/lib/payloads';

type NotificationSettingsActions = {
	updateGuildNotificationSettings?: (guildId: string, update: NotificationUpdate) => unknown;
};

type OptInChannelsActions = {
	toggleShowAllChannels?: (guildId: string) => unknown;
};

type UserGuildSettings = {
	isOptInEnabled?: (guildId: string) => boolean;
};

// Every feature applies the defaults through these, so they are looked up once for all of them.
export const NotificationSettings: NotificationSettingsActions | undefined = metro.findByProps(
	'updateGuildNotificationSettings',
);

export const OptInChannels: OptInChannelsActions | undefined =
	metro.findByProps('toggleShowAllChannels');

export const UserGuildSettingsStore = flux.getStore('UserGuildSettings') as ReturnType<
	typeof flux.getStore
> &
	UserGuildSettings;
