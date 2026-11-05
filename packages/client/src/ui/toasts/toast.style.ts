import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	// A closing toast slides under the ones still showing.
	open: {
		zIndex: 10,
	},
	closing: {
		zIndex: 0,
	},
	list: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
	},
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
	content: {
		height: 'auto',
	},
	icon: {
		marginVertical: 10,
		marginLeft: 12,
	},
	image: {
		width: 24,
		aspectRatio: 1,
	},
	closeButton: {
		marginVertical: 6,
		marginLeft: 8,
		marginRight: 8,
	},
	buttons: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		marginHorizontal: 12,
		marginTop: 5,
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
