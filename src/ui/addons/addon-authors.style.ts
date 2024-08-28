import { Constants, StyleSheet, Theme } from '@metro/common';

export default StyleSheet.createStyles({
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