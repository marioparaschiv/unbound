import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Discord's Stack sets `width: '100%'`; as a row's trailing control it would squeeze the label.
	trailing: {
		width: 'auto',
	},
});
