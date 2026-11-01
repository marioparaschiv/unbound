import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	error: {
		marginTop: 6,
		color: Theme.colors.TEXT_FEEDBACK_CRITICAL,
	},
});
