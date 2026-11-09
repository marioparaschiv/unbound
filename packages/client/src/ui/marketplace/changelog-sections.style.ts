import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	sections: {
		gap: 10,
	},
	section: {
		gap: 4,
	},
	label: {
		letterSpacing: 0.6,
	},
	added: {
		color: Theme.colors.TEXT_FEEDBACK_POSITIVE,
	},
	changed: {
		color: Theme.colors.TEXT_FEEDBACK_INFO,
	},
	fixed: {
		color: Theme.colors.TEXT_FEEDBACK_WARNING,
	},
	removed: {
		color: Theme.colors.TEXT_FEEDBACK_CRITICAL,
	},
	item: {
		flexDirection: 'row',
		gap: 8,
	},
	bullet: {
		color: Theme.colors.TEXT_MUTED,
	},
	text: {
		flex: 1,
		lineHeight: 19,
		color: Theme.colors.TEXT_DEFAULT,
	},
});
