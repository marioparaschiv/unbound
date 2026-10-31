import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	frame: {
		overflow: 'hidden',
		borderRadius: Theme.radii.lg,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	fill: {
		width: '100%',
		height: '100%',
	},
});
