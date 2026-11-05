import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		padding: 32,
	},
	image: {
		width: 220,
		height: 220,
	},
	text: {
		textAlign: 'center',
		color: Theme.colors.TEXT_MUTED,
	},
});
