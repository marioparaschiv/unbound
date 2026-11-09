import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	card: {
		height: 64,
		maxWidth: 260,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingLeft: 12,
		paddingRight: 18,
	},
	name: {
		flexShrink: 1,
		color: Theme.colors.TEXT_STRONG,
	},
});
