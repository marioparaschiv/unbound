import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		showTimeouts: setting.boolean({
			default: true,
			title: 'SHOW_TIMEOUTS',
			subtitle: 'SHOW_TIMEOUTS_SUBTITLE',
		}),
		showInvitesPaused: setting.boolean({
			default: true,
			title: 'SHOW_INVITES_PAUSED',
			subtitle: 'SHOW_INVITES_PAUSED_SUBTITLE',
		}),
	},
	{ title: 'VISIBILITY' },
);
