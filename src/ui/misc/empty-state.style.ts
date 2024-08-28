import { Constants, StyleSheet, Theme } from '@api/metro/common';

export default StyleSheet.createStyles({
	recoveryContainer: {
		marginTop: 10
	},

	empty: {
		justifyContent: 'center',
		alignItems: 'center',
		marginVertical: 40
	},

	emptyImage: {
		marginBottom: 10
	},

	emptyMessage: {
		color: Theme.colors.TEXT_MUTED,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		textAlign: 'center',
		paddingHorizontal: 25
	}
});