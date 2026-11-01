import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	stage: {
		height: 132,
		justifyContent: 'center',
		borderRadius: 16,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_SUBTLE,
		backgroundColor: Theme.colors.BACKGROUND_BASE_LOWER,
		overflow: 'hidden',
	},
	shape: {
		position: 'absolute',
		width: 96,
		height: 96,
		borderRadius: 48,
	},
	brand: {
		top: -18,
		left: 28,
		backgroundColor: Theme.colors.BACKGROUND_BRAND,
	},
	positive: {
		bottom: -30,
		left: '42%',
		backgroundColor: Theme.colors.TEXT_FEEDBACK_POSITIVE,
	},
	warning: {
		top: -6,
		right: 24,
		backgroundColor: Theme.colors.TEXT_FEEDBACK_WARNING,
	},
	toast: {
		position: 'relative',
		marginTop: 0,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingRight: 12,
	},
});
