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
		hideBlockedUsers: setting.boolean({
			default: true,
			title: 'HIDE_BLOCKED_USERS',
			subtitle: 'HIDE_BLOCKED_USERS_SUBTITLE',
		}),
	},
	{ title: 'PREFERENCES' },
);
