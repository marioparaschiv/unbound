import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	current: {
		tintColor: Theme.colors.ICON_FEEDBACK_POSITIVE,
	},
	paused: {
		tintColor: Theme.colors.ICON_FEEDBACK_WARNING,
	},
	blocked: {
		tintColor: Theme.colors.ICON_FEEDBACK_WARNING,
	},
	update: {
		tintColor: Theme.colors.TEXT_BRAND,
	},
});
