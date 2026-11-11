import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	title: {
		color: Theme.colors.MOBILE_TEXT_HEADING_PRIMARY,
	},
});
