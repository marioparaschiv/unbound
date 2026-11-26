import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	notice: {
		gap: 12,
		padding: 16,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: Theme.colors.BORDER_FEEDBACK_CRITICAL,
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_CRITICAL,
	},
	heading: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	icon: {
		width: 28,
		height: 28,
		tintColor: Theme.colors.ICON_FEEDBACK_CRITICAL,
	},
	gate: {
		gap: 14,
		paddingVertical: 4,
	},
	answer: {
		borderRadius: 12,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	answerWrong: {
		borderColor: Theme.colors.BORDER_FEEDBACK_CRITICAL,
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_CRITICAL,
	},
	banner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginBottom: 8,
		padding: 4,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	bannerBody: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 8,
		paddingLeft: 12,
	},
	bannerIcon: {
		width: 20,
		height: 20,
		tintColor: Theme.colors.ICON_FEEDBACK_WARNING,
	},
	bannerText: {
		flex: 1,
		gap: 2,
	},
});
