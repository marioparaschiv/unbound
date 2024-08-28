import { Constants, StyleSheet, Theme } from '@metro/common';

export default StyleSheet.createStyles({
	toastShadow: Theme.shadows.SHADOW_MEDIUM,
	container: {
		backgroundColor: Theme.colors.TOAST_BG,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
		alignSelf: 'center',
		borderRadius: 14,
		width: '90%',
		maxWidth: 500,
		zIndex: 999999,
		elevation: 999999,
		position: 'absolute',
		padding: 2,
		marginTop: 20,
		overflow: 'hidden'
	},
	wrapper: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center'
	},
	contentContainer: {
		marginLeft: 12,
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'center'
	},
	title: {
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 14
	},
	content: {
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		color: Theme.colors.TEXT_MUTED,
		fontSize: 12,
		height: 'auto'
	},
	icon: {
		marginTop: 10,
		marginLeft: 12
	},
	buttons: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		marginHorizontal: 12,
		marginBottom: 12,
		gap: 5
	},
	button: {
		width: '45%',
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	bar: {
		backgroundColor: Theme.colors.REDESIGN_BUTTON_PRIMARY_BACKGROUND
	}
});