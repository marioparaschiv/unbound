import { Discord } from '@api/metro/components';
import { Theme } from '@api/metro/common';


export default Discord.createStyles({
	container: {
		backgroundColor: Theme.colors.BACKGROUND_PRIMARY,

		width: '100%',
		height: '100%',

		flex: 1,
		gap: 12
	},

	cardShadow: Theme.shadows.SHADOW_BORDER,

	card: {
		backgroundColor: Theme.colors.BACKGROUND_SECONDARY,
		borderRadius: 20,
		marginHorizontal: 16
	},

	cardContainer: {
		margin: 16,
		flexGrow: 1,
	},

	headerContainer: {
		flexDirection: 'column',
		flex: 1,
		overflow: 'hidden',
		gap: 6
	},

	actionsCard: {
		borderRadius: 99999
	},

	actionsContainer: {
		flexDirection: 'row',
	},

	headerChainIcon: {
		aspectRatio: 1,
		height: 48,
		borderRadius: 999
	},

	headerChainGhostIcon: {
		transform: [
			{ rotateZ: '20deg' },
			{ scale: 1.4 }
		],
		opacity: 0.3,
	},

	outlineCard: {
		overflow: 'hidden',
		flexGrow: 1
	},

	outlineCodeblock: {
		borderRadius: 16,
		marginHorizontal: 4,
		flexGrow: 1
	},

	outlineSegmentedControl: {
		marginTop: 16
	}
});