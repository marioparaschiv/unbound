import { Discord } from '~/metro/design';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
	},
	warning: {
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_WARNING,
		borderColor: Theme.colors.BORDER_FEEDBACK_WARNING,
	},
	info: {
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_INFO,
		borderColor: Theme.colors.BORDER_FEEDBACK_INFO,
	},
	critical: {
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_CRITICAL,
		borderColor: Theme.colors.BORDER_FEEDBACK_CRITICAL,
	},
	positive: {
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_POSITIVE,
		borderColor: Theme.colors.BORDER_FEEDBACK_POSITIVE,
	},
	warningIcon: {
		tintColor: Theme.colors.ICON_FEEDBACK_WARNING,
	},
	infoIcon: {
		tintColor: Theme.colors.ICON_FEEDBACK_INFO,
	},
	criticalIcon: {
		tintColor: Theme.colors.ICON_FEEDBACK_CRITICAL,
	},
	positiveIcon: {
		tintColor: Theme.colors.ICON_FEEDBACK_POSITIVE,
	},
	text: {
		flex: 1,
	},
	message: {
		color: Theme.colors.TEXT_DEFAULT,
	},
	button: {
		marginLeft: 4,
	},
});
