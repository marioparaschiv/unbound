import { settings } from '@unbound-app/settings';

import { NotificationSettings, OptInChannels, UserGuildSettingsStore } from '~/lib/modules';
import { buildNotificationUpdates, isApplicableGuildId } from '~/lib/payloads';

function showAllChannels(guildId: string): void {
	const toggle = OptInChannels?.toggleShowAllChannels;
	const isOptInEnabled = UserGuildSettingsStore.isOptInEnabled;

	if (typeof toggle !== 'function' || typeof isOptInEnabled !== 'function') {
		logger.warn('Show all channels is unavailable in this Discord build');

		return;
	}

	if (isOptInEnabled.call(UserGuildSettingsStore, guildId)) {
		toggle.call(OptInChannels, guildId);
	}
}

/**
 * @description Applies the chosen notification and channel defaults to one server, as Vencord's `applyDefaultSettings` does.
 * Calls `updateGuildNotificationSettings` on Discord's notification settings actions, which saves the change to the account,
 * then `toggleShowAllChannels` on the opt-in channels actions when `UserGuildSettingsStore.isOptInEnabled` says the server hides channels.
 * @param guildId The server to change; the DM pseudo-guild and empty IDs are ignored.
 * @returns `true` when the notification updates were sent.
 */
export function applyNewGuildSettings(guildId: unknown): boolean {
	if (!isApplicableGuildId(guildId)) return false;

	const update = NotificationSettings?.updateGuildNotificationSettings;

	if (typeof update !== 'function') {
		logger.warn('updateGuildNotificationSettings is missing; nothing applied');

		return false;
	}

	for (const payload of buildNotificationUpdates(settings)) {
		update.call(NotificationSettings, guildId, payload);
	}

	if (settings.showAllChannels) showAllChannels(guildId);

	return true;
}

export default applyNewGuildSettings;
