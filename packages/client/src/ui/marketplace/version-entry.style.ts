import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

const DOT = 10;

export default Discord.createStyles({
	entry: {
		flexDirection: 'row',
		gap: 12,
	},
	rail: {
		width: DOT,
		alignItems: 'center',
		paddingTop: 6,
	},
	dot: {
		width: DOT,
		height: DOT,
		borderRadius: DOT / 2,
		backgroundColor: Theme.colors.BACKGROUND_MOD_STRONG,
	},
	latestDot: {
		backgroundColor: Theme.colors.TEXT_BRAND,
	},
	line: {
		flex: 1,
		width: 1,
		marginTop: 4,
		backgroundColor: Theme.colors.BORDER_SUBTLE,
	},
	body: {
		flex: 1,
		minWidth: 0,
		gap: 6,
	},
	spaced: {
		paddingBottom: 20,
	},
	title: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	version: {
		color: Theme.colors.TEXT_STRONG,
	},
	date: {
		marginTop: -4,
		color: Theme.colors.TEXT_MUTED,
	},
	plain: {
		lineHeight: 19,
		color: Theme.colors.TEXT_DEFAULT,
	},
});
