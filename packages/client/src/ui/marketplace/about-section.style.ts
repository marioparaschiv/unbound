import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	facts: {
		gap: 10,
	},
	fact: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	label: {
		color: Theme.colors.TEXT_MUTED,
	},
	value: {
		flexShrink: 1,
		textAlign: 'right',
		color: Theme.colors.TEXT_DEFAULT,
	},
});
