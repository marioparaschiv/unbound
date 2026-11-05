import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	content: {
		flex: 1,
		minWidth: 0,
		gap: 3,
	},
	author: {
		color: Theme.colors.TEXT_MUTED,
	},
	description: {
		marginTop: 5,
		lineHeight: 19,
		color: Theme.colors.TEXT_DEFAULT,
	},
});
