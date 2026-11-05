import { Discord } from '~/metro/components';

export default Discord.createStyles({
	swatches: {
		flexWrap: 'wrap',
	},
	swatch: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.6)',
	},
	picked: {
		borderWidth: 3,
	},
});
