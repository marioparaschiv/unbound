import { Constants, StyleSheet, Theme } from '@metro/common';

export default StyleSheet.createStyles({
	block: {
		fontFamily: Constants.Fonts.CODE_SEMIBOLD,
		fontSize: 12,

		backgroundColor: Theme.colors.BACKGROUND_SECONDARY_ALT,
		color: Theme.colors.TEXT_NORMAL,

		padding: 10
	}
});