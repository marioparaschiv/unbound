import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	name: {
		flexShrink: 1,
		minWidth: 0,
		color: Theme.colors.TEXT_STRONG,
	},
});
