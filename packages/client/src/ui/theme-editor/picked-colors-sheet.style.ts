import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	body: {
		gap: 16,
		paddingBottom: 16,
	},
	swatch: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
	},
});
