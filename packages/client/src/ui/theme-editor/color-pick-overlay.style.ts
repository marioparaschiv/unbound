import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	hint: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'center',
		gap: 12,
		width: '90%',
		maxWidth: 500,
		marginTop: 12,
		paddingVertical: 8,
		paddingLeft: 16,
		paddingRight: 8,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
		...Theme.shadows.SHADOW_MEDIUM,
	},
	text: {
		flex: 1,
	},
});
