import { Constants, StyleSheet, Theme } from '@api/metro/common';

export default StyleSheet.createStyles({
	card: {
		marginRight: 8
	},

	header: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 20,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		marginBottom: 0
	},

	description: {
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 14,
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		marginBottom: 0
	}
});