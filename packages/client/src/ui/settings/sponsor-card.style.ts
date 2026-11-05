import LOGO_COLORS from '~/ui/icons/logo-colors';
import { Discord } from '~/metro/components';

export default Discord.createStyles({
	card: {
		gap: 10,
		padding: 18,
	},
	title: {
		flexShrink: 1,
	},
	// The logo's red marks the one call to action on the page.
	heart: {
		width: 30,
		height: 30,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 9,
		backgroundColor: LOGO_COLORS.red,
	},
	heartIcon: {
		tintColor: '#FFFFFF',
	},
	body: {
		lineHeight: 19,
	},
	actions: {
		flexDirection: 'row',
		gap: 8,
		marginTop: 4,
	},
	action: {
		flex: 1,
	},
});
