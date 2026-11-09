import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

// The pinned controls follow the Plugins page (`./plugins/plugins.style`): 12 above and below, a hairline under.
export default Discord.createStyles({
	fill: {
		flex: 1,
	},
	header: {
		flexGrow: 0,
		flexShrink: 0,
		gap: 12,
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.BORDER_SUBTLE,
	},
	search: {
		flex: 1,
		minWidth: 0,
	},
});
