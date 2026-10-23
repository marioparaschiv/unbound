import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

export default Discord.createStyles({
	// `TableRowIcon`'s danger variant shrinks the icon into a 16px badge, so tint a full-size one instead.
	dangerIcon: {
		width: 24,
		height: 24,
		tintColor: Theme.colors.TEXT_FEEDBACK_CRITICAL,
	},
});
