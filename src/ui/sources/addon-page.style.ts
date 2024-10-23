import { Constants, Theme } from '@api/metro/common';
import { Discord } from '@api/metro/components';

export default Discord.createStyles({
	header: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 28,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		marginBottom: 0
	},

	description: {
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 14,
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		marginBottom: 0,
		marginTop: -4
	}
});