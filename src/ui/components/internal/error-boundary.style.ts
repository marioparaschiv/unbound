import { Constants, StyleSheet, Theme } from '@metro/common';

export default StyleSheet.createStyles({
	container: {
		backgroundColor: Theme.colors.BACKGROUND_TERTIARY,

		width: '100%',
		height: '100%',

		flex: 1,
		paddingVertical: 30
	},

	cardShadow: Theme.shadows.SHADOW_HIGH,

	card: {
		backgroundColor: Theme.colors.BACKGROUND_PRIMARY,

		marginHorizontal: 20,
		marginBottom: 12,
		borderRadius: 20,

		...Theme.shadows.SHADOW_BORDER
	},

	headerChainIcon: {
		width: undefined,
		height: '45%',
		aspectRatio: 1,

		right: 30,
		top: '27.5%',

		borderRadius: 1000,
		position: 'absolute',
	},

	headerTitle: {
		color: Theme.colors.HEADER_PRIMARY,
		width: '60%',

		fontSize: 22,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		letterSpacing: -0.5,

		marginTop: 20,
		marginBottom: 10,
		marginLeft: 20,
	},

	headerBody: {
		color: Theme.colors.TEXT_NORMAL,
		width: '50%',

		fontSize: 18,
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,

		marginBottom: 20,
		marginLeft: 20,
	},

	outlineTitle: {
		color: Theme.colors.TEXT_NORMAL,
		width: '100%',
		textAlign: 'center',

		fontSize: 18,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		letterSpacing: -0.5,

		marginVertical: 10
	},

	outlineCodeblock: {
		marginHorizontal: 10,
		marginBottom: 10,

		borderRadius: 20,
		flexGrow: 1,

		...Theme.shadows.SHADOW_LOW
	}
});