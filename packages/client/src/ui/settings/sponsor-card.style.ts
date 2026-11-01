import LOGO_COLORS from '~/ui/icons/logo-colors';
import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	card: {
		gap: 10,
		padding: 18,
		borderRadius: 16,
		backgroundColor: Theme.colors.TABLEROW_BACKGROUND_DEFAULT,
	},
	heading: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
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
