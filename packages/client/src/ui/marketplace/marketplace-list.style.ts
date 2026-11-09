import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

// Laid out like the Plugins page (`~/ui/settings/plugins/plugins.style`).
export default Discord.createStyles({
	content: {
		padding: 16,
	},
	// The skeleton fills the tab, as the full page of cards that replaces it will.
	loading: {
		flex: 1,
		paddingTop: 16,
		paddingHorizontal: 16,
	},
	header: {
		gap: 12,
		paddingBottom: 12,
	},
	card: {
		paddingBottom: 12,
	},
	empty: {
		flex: 1,
		padding: 16,
		justifyContent: 'center',
	},
	// Read as a resolved colour for the refresh control's `tintColor` prop.
	spinner: {
		color: Theme.colors.INTERACTIVE_ICON_DEFAULT,
	},
});
