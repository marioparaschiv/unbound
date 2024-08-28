import { Constants, StyleSheet, Theme } from '@api/metro/common';

export default StyleSheet.createStyles({
	container: {
		marginLeft: 8,
		marginTop: 4,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4
	},

	tagsLabel: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 16,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		marginBottom: 0,
		marginHorizontal: 4
	},

	tagBackground: {
		backgroundColor: Theme.colors.BG_BASE_SECONDARY,
		borderRadius: 10,
		marginRight: 2
	},

	tag: {
		color: Theme.colors.TEXT_NORMAL,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		paddingHorizontal: 8,
		paddingVertical: 2,
		marginBottom: 0,
		fontSize: 16
	}
});