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
	content: {
		padding: 16,
	},
});
