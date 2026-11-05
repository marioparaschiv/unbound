import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	page: {
		flex: 1,
	},
	controls: {
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
	card: {
		paddingBottom: 12,
	},
	content: {
		padding: 16,
	},
	empty: {
		flex: 1,
		padding: 16,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
	},
});
