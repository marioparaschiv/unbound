import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

export default Discord.createStyles({
	swatch: {
		width: 44,
		height: 44,
		margin: 4,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
	},
	selected: {
		borderWidth: 2,
		borderColor: Theme.colors.BORDER_FOCUS,
	},
});
