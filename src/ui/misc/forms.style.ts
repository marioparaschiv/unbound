import { Constants, StyleSheet, Theme } from '@api/metro/common';

export default StyleSheet.createStyles({
	endStyle: {
		backgroundColor: Theme.colors.CARD_PRIMARY_BG ?? Theme.colors.BACKGROUND_PRIMARY,
		borderBottomLeftRadius: 16,
		borderBottomRightRadius: 16
	},

	formText: {
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		color: Theme.colors.TEXT_MUTED,
		fontSize: 14
	},

	formHint: {
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		color: Theme.colors.TEXT_MUTED,
		fontSize: 12,
		marginTop: 10,
		marginHorizontal: 16
	},

	iconTint: {
		tintColor: Theme.colors.INTERACTIVE_NORMAL
	},

	sectionWrapper: {
		marginHorizontal: 16
	}
});