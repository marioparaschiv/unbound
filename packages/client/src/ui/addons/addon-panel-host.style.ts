import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	notice: {
		padding: 16,
		textAlign: 'center',
		color: Theme.colors.TEXT_MUTED,
	},
});
