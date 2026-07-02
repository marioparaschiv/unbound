import { Constants, Theme } from '~/api/metro/common';
import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	toastShadow: Theme.shadows.SHADOW_MEDIUM,
	container: {
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
		alignSelf: 'center',
		borderRadius: 18,
		width: '90%',
		maxWidth: 500,
		position: 'absolute',
		padding: 4,
		marginTop: 20,
		overflow: 'hidden',
	},
	wrapper: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	contentContainer: {
		marginLeft: 12,
		marginVertical: 8,
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'center',
	},
	title: {
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		color: Theme.colors.TEXT_DEFAULT,
		fontSize: 14,
	},
	content: {
		height: 'auto',
	},
	icon: {
		marginVertical: 10,
		marginLeft: 12,
	},
	closeButton: {
		marginVertical: 10,
		marginLeft: 12,
		marginRight: 12,
	},
	iconTint: {
		tintColor: Theme.colors.INTERACTIVE_ICON_DEFAULT,
	},
	buttons: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		marginHorizontal: 12,
		marginBottom: 12,
		gap: 5,
	},
	button: {
		width: '45%',
		flexGrow: 1,
		justifyContent: 'space-between',
	},
	progressBar: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		height: 3,
		borderRadius: 100000,
	},
	bar: {
		backgroundColor: Theme.colors.BACKGROUND_BRAND,
	},
});
