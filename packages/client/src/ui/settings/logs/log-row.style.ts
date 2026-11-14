import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	row: {
		gap: 2,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.BORDER_SUBTLE,
	},
	meta: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	scope: {
		flex: 1,
		minWidth: 0,
	},
	unbound: {
		color: Theme.colors.TEXT_BRAND,
	},
	js: {
		color: Theme.colors.TEXT_FEEDBACK_WARNING,
	},
	reactNative: {
		color: Theme.colors.TEXT_FEEDBACK_INFO,
	},
	native: {
		color: Theme.colors.TEXT_FEEDBACK_POSITIVE,
	},
	debug: {
		color: Theme.colors.TEXT_MUTED,
	},
	info: {
		color: Theme.colors.TEXT_DEFAULT,
	},
	warn: {
		color: Theme.colors.TEXT_FEEDBACK_WARNING,
	},
	error: {
		color: Theme.colors.TEXT_FEEDBACK_CRITICAL,
	},
});
