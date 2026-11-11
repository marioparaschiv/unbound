import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Discord's Stack sets `width: '100%'`; as a row's trailing control it would squeeze the label.
	trailing: {
		width: 'auto',
	},
	// Discord's `IconButton` takes its corner radius from the theme's button token; its `pillStyle` overrides it.
	round: {
		borderRadius: 999,
	},
});
