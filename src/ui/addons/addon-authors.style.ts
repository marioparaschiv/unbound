import { Constants, Theme } from '@api/metro/common';
import { Discord } from '@api/metro/components';


export default Discord.createStyles({
	authors: {
		color: Theme.colors.TEXT_NORMAL,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		marginLeft: -4
	},

	description: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 16,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		marginBottom: 0
	},

	iconTint: {
		tintColor: Theme.colors.INTERACTIVE_NORMAL
	}
});