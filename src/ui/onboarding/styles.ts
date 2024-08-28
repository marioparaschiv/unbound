import { StyleSheet, Theme } from '@api/metro/common';

export default StyleSheet.createStyles({
	container: {
		flex: 1,
		flexGrow: 1,
		justifyContent: 'space-between',
		alignItems: 'center'
	},

	innerContainer: {
		width: '90%',
		alignItems: 'center'
	},

	progressInactive: {
		backgroundColor: Theme.colors.BG_BASE_SECONDARY
	},

	progressActive: {
		backgroundColor: Theme.colors.REDESIGN_BUTTON_PRIMARY_BACKGROUND
	},

	page: {
		backgroundColor: Theme.colors.BG_BASE_PRIMARY
	},

	title: {
		color: Theme.colors.HEADER_PRIMARY
	},

	subtitle: {
		color: Theme.colors.HEADER_SECONDARY
	}
});