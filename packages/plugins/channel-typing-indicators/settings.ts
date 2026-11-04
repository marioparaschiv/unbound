import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	includeCurrentChannel: setting.boolean({
		default: true,
		title: 'INCLUDE_CURRENT_CHANNEL',
		subtitle: 'INCLUDE_CURRENT_CHANNEL_SUBTITLE',
	}),
	includeMutedChannels: setting.boolean({
		default: false,
		title: 'INCLUDE_MUTED_CHANNELS',
		subtitle: 'INCLUDE_MUTED_CHANNELS_SUBTITLE',
	}),
	includeIgnoredUsers: setting.boolean({
		default: false,
		title: 'INCLUDE_IGNORED_USERS',
		subtitle: 'INCLUDE_IGNORED_USERS_SUBTITLE',
	}),
	includeBlockedUsers: setting.boolean({
		default: false,
		title: 'INCLUDE_BLOCKED_USERS',
		subtitle: 'INCLUDE_BLOCKED_USERS_SUBTITLE',
	}),
	// Bit flags (`IndicatorMode`), picked in the custom panel's radio group.
	indicatorMode: setting.integer({ default: 3, min: 1, max: 3, hidden: true }),
});
