import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		token: setting.string({ default: '', hidden: true }),
		lastReviewId: setting.integer({ default: 0, hidden: true }),
		notifyReviews: setting.boolean({
			default: true,
			title: 'NOTIFY_REVIEWS',
			subtitle: 'NOTIFY_REVIEWS_SUBTITLE',
		}),
		hideTimestamps: setting.boolean({ default: false, title: 'HIDE_TIMESTAMPS' }),
		hideSystemReviews: setting.boolean({
			default: false,
			title: 'HIDE_SYSTEM_REVIEWS',
			subtitle: 'HIDE_SYSTEM_REVIEWS_SUBTITLE',
		}),
		themeSheet: setting.boolean({
			default: false,
			title: 'THEME_SHEET',
			subtitle: 'THEME_SHEET_SUBTITLE',
		}),
		hideBlockedUsers: setting.boolean({
			default: true,
			title: 'HIDE_BLOCKED_USERS',
			subtitle: 'HIDE_BLOCKED_USERS_SUBTITLE',
		}),
		account: setting.section(
			{ title: 'ACCOUNT' },
			{
				authorize: setting.button({
					title: 'AUTHORIZE',
					subtitle: 'AUTHORIZE_SUBTITLE',
					action: 'authorize',
					visibleWhen: (settings) => !settings.token,
				}),
				reauthorize: setting.button({
					title: 'REAUTHORIZE',
					subtitle: 'REAUTHORIZE_SUBTITLE',
					action: 'authorize',
					visibleWhen: (settings) => Boolean(settings.token),
				}),
				viewMyReviews: setting.button({
					title: 'VIEW_MY_REVIEWS',
					action: 'viewMyReviews',
				}),
				manageBlockedUsers: setting.button({
					title: 'MANAGE_BLOCKED_USERS',
					subtitle: 'MANAGE_BLOCKED_USERS_SUBTITLE',
					action: 'manageBlockedUsers',
					disabledWhen: (settings) => !settings.token,
				}),
			},
		),
		links: setting.section(
			{ title: 'LINKS' },
			{
				website: setting.button({ title: 'WEBSITE', action: 'openWebsite' }),
				supportServer: setting.button({
					title: 'SUPPORT_SERVER',
					action: 'openSupportServer',
				}),
			},
		),
	},
	{ title: 'PREFERENCES' },
);
