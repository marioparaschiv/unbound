import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Discord's Stack sets `width: '100%'`; as a row's trailing control it would squeeze the label.
	trailing: {
		width: 'auto',
	},
	hidden: {
		opacity: 0,
	},
	swatch: {
		width: 28,
		height: 28,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.24)',
	},
});
